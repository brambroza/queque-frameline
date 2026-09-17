/**
 * Booking status rules shared by the public LIFF routes, the LINE webhook and
 * the portal API. Pure functions only, so they are unit-testable and the two
 * sides of the product (customer / staff) can never drift apart.
 *
 * Flow:
 *   pending_approval ─(staff อนุมัติ)─▶ confirmed
 *   confirmed ─(customer "ฉันมาถึงแล้ว")─▶ checked_in
 *   confirmed | checked_in ─(staff รอเรียก)─▶ waiting
 *   confirmed | checked_in | waiting ─(staff เรียกคิว → LINE push)─▶ called
 *   called ─(staff เริ่มบริการ)─▶ serving ─▶ completed
 */

/** Service columns that decide whether a LIFF booking needs shop approval. */
export type ServiceApprovalRule = {
  requires_approval?: boolean | null;
  booking_mode?: string | null;
};

/**
 * Initial status of a customer-created booking.
 *
 * A service flagged `requires_approval`, or whose booking mode is
 * `request_approval`, starts as `pending_approval` and holds its slot until a
 * staff member confirms or cancels it. Everything else is confirmed at once.
 */
export function resolveInitialBookingStatus(service: ServiceApprovalRule | null | undefined): 'pending_approval' | 'confirmed' {
  if (!service) return 'confirmed';
  if (service.requires_approval === true) return 'pending_approval';
  if (service.booking_mode === 'request_approval') return 'pending_approval';
  return 'confirmed';
}

/** Statuses the LIFF account tab treats as "upcoming" (still alive). */
export const CUSTOMER_ACTIVE_STATUSES = ['pending', 'pending_approval', 'confirmed', 'checked_in', 'waiting', 'called', 'serving'] as const;

/** Statuses a customer may still cancel from LIFF (not once called or in service). */
export const CUSTOMER_CANCELLABLE_STATUSES = ['pending', 'pending_approval', 'confirmed', 'checked_in', 'waiting'] as const;

/** Statuses from which a customer may declare arrival. */
export const CUSTOMER_CHECKIN_STATUSES = ['pending', 'confirmed'] as const;

/** Statuses from which staff can call the customer (→ `called`). */
export const STAFF_CALLABLE_STATUSES = ['confirmed', 'checked_in', 'waiting', 'called'] as const;

export type CheckInDenialReason = 'wrong_status' | 'not_today' | 'already_checked_in';

export type CheckInEligibility = { ok: true } | { ok: false; reason: CheckInDenialReason };

/**
 * Whether a customer may check in to this booking right now.
 *
 * Only on the booking day (Bangkok date) and only while the booking is still
 * waiting for them — a booking already called, served or cancelled cannot be
 * checked in, and a second tap is reported as `already_checked_in` so the UI
 * can stay quiet instead of erroring.
 *
 * @param booking - Status and date of the booking.
 * @param todayIso - Today's date as `YYYY-MM-DD` in Asia/Bangkok.
 */
export function checkInEligibility(booking: { status: string; booking_date: string }, todayIso: string): CheckInEligibility {
  if (booking.status === 'checked_in') return { ok: false, reason: 'already_checked_in' };
  if (!(CUSTOMER_CHECKIN_STATUSES as readonly string[]).includes(booking.status)) return { ok: false, reason: 'wrong_status' };
  if (String(booking.booking_date).slice(0, 10) !== todayIso) return { ok: false, reason: 'not_today' };
  return { ok: true };
}

/** Thai message for a refused check-in. */
export function checkInDenialMessage(reason: CheckInDenialReason): string {
  switch (reason) {
    case 'already_checked_in':
      return 'เช็คอินไว้แล้วค่ะ';
    case 'not_today':
      return 'เช็คอินได้เฉพาะวันที่จองเท่านั้นค่ะ';
    default:
      return 'คิวนี้ไม่สามารถเช็คอินได้แล้วค่ะ';
  }
}

/**
 * Whether staff moving `prev` → `next` means "call this customer now".
 * Re-calling an already-called booking counts (call_count goes up, LINE re-pushes).
 */
export function isCallTransition(prev: string | null | undefined, next: string): boolean {
  if (next !== 'called') return false;
  return (STAFF_CALLABLE_STATUSES as readonly string[]).includes(String(prev ?? ''));
}

/** Whether staff moving `prev` → `next` is an approval of a pending request. */
export function isApprovalTransition(prev: string | null | undefined, next: string): boolean {
  return prev === 'pending_approval' && next === 'confirmed';
}
