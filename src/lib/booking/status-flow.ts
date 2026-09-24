/**
 * Dock-queue status rules shared by the public token routes, the portal API
 * and the cron sweep. Pure functions only so both sides can never drift apart.
 *
 * Flow:
 *   pending ─(admin ยืนยัน + ออก DO)─▶ confirmed ─(staff เช็คอินหน้าประตู)─▶ checked_in
 *   checked_in ─(staff เรียก / auto-call เมื่อท่าว่าง)─▶ called ─▶ serving ─▶ completed
 *   confirmed ─(เลย grace)─▶ late ─(มาถึง)─▶ checked_in      late ─▶ no_show
 *   called ─(ยกเลิกการเรียก)─▶ checked_in                     called ─(ไม่มา)─▶ no_show
 */
import type { BookingStatus } from '@/types/db';

/** How the booking entered the system. */
export type BookingSource = 'customer_link' | 'admin' | 'api';

/** Who is asking for a transition. `system` = cron sweep / auto-call. */
export type TransitionActor = 'admin' | 'staff' | 'customer' | 'system';

/** Every legal move. Anything not listed is refused by the API. */
export const ALLOWED_TRANSITIONS: Record<BookingStatus, readonly BookingStatus[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['checked_in', 'late', 'no_show', 'cancelled'],
  late: ['checked_in', 'no_show', 'cancelled'],
  checked_in: ['called', 'cancelled'],
  called: ['called', 'serving', 'checked_in', 'no_show'],
  serving: ['completed'],
  completed: [],
  cancelled: [],
  no_show: [],
};

/**
 * Moves only an admin may make. Empty since 2026-09-21: warehouse staff approve
 * queues too (the SO payment gate, not the role, is what protects the DO).
 */
const ADMIN_ONLY: ReadonlyArray<`${BookingStatus}>${BookingStatus}`> = [];

/** Moves the cron sweep may make on its own. */
const SYSTEM_MOVES: ReadonlyArray<`${BookingStatus}>${BookingStatus}`> = [
  'confirmed>late',
  'late>no_show',
  'called>no_show',
  'checked_in>called',
];

export const TERMINAL_STATUSES: readonly BookingStatus[] = ['completed', 'cancelled', 'no_show'];

/** Statuses that still hold their dock/slot. */
export const LIVE_STATUSES: readonly BookingStatus[] = ['pending', 'confirmed', 'late', 'checked_in', 'called', 'serving'];

/** Statuses a customer may still cancel from their booking link. */
export const CUSTOMER_CANCELLABLE_STATUSES: readonly BookingStatus[] = ['pending', 'confirmed', 'late'];

/**
 * Statuses in which the customer may still change the vehicle / driver from
 * their booking link. Once the truck is checked in the gate has verified the
 * plate, so only staff may correct it from then on.
 */
export const CUSTOMER_VEHICLE_EDITABLE_STATUSES: readonly BookingStatus[] = ['pending', 'confirmed', 'late'];

/** Whether the customer may change plate / driver for a booking in `status`. */
export function canCustomerEditVehicle(status: string): boolean {
  return (CUSTOMER_VEHICLE_EDITABLE_STATUSES as readonly string[]).includes(status);
}

/** Statuses from which the vehicle may be checked in at the gate. */
export const CHECKIN_STATUSES: readonly BookingStatus[] = ['confirmed', 'late'];

/** Statuses occupying a dock right now. */
export const ON_DOCK_STATUSES: readonly BookingStatus[] = ['called', 'serving'];

export function isKnownStatus(value: string): value is BookingStatus {
  return Object.prototype.hasOwnProperty.call(ALLOWED_TRANSITIONS, value);
}

export function isTerminalStatus(status: string): boolean {
  return (TERMINAL_STATUSES as readonly string[]).includes(status);
}

/**
 * Initial status of a new booking.
 * Admin-created queues are confirmed at once (DO issued); a customer/supplier
 * link booking waits for the admin unless the site turned confirmation off.
 */
export function resolveInitialBookingStatus(input: { source: BookingSource; requireAdminConfirm: boolean; paymentCleared?: boolean }): 'pending' | 'confirmed' {
  // An unpaid SO can be booked but never starts confirmed, whoever creates the queue.
  if (input.paymentCleared === false) return 'pending';
  if (input.source === 'admin') return 'confirmed';
  return input.requireAdminConfirm ? 'pending' : 'confirmed';
}

export type TransitionDenial = 'unknown_status' | 'not_allowed' | 'admin_only' | 'not_customer_cancellable';

export type TransitionCheck = { ok: true } | { ok: false; reason: TransitionDenial };

/**
 * Whether `actor` may move a booking `from` → `to`.
 *
 * @param from Current status (from the DB row, not the client).
 * @param to Requested status.
 * @param actor Who is asking.
 */
export function canTransition(from: string, to: string, actor: TransitionActor): TransitionCheck {
  if (!isKnownStatus(from) || !isKnownStatus(to)) return { ok: false, reason: 'unknown_status' };
  if (!ALLOWED_TRANSITIONS[from].includes(to)) return { ok: false, reason: 'not_allowed' };
  const key = `${from}>${to}` as const;
  if (actor === 'customer') {
    const ok = to === 'cancelled' && CUSTOMER_CANCELLABLE_STATUSES.includes(from);
    return ok ? { ok: true } : { ok: false, reason: 'not_customer_cancellable' };
  }
  if (actor === 'system') {
    return SYSTEM_MOVES.includes(key) ? { ok: true } : { ok: false, reason: 'not_allowed' };
  }
  if (actor === 'staff' && ADMIN_ONLY.includes(key)) return { ok: false, reason: 'admin_only' };
  return { ok: true };
}

/** Thai message for a refused transition. */
export function transitionDenialMessage(reason: TransitionDenial): string {
  switch (reason) {
    case 'admin_only':
      return 'เฉพาะผู้ดูแลระบบเท่านั้นที่ยืนยันคิวได้';
    case 'not_customer_cancellable':
      return 'คิวนี้ไม่สามารถยกเลิกได้แล้ว กรุณาติดต่อเจ้าหน้าที่';
    case 'unknown_status':
      return 'สถานะไม่ถูกต้อง';
    default:
      return 'ไม่สามารถเปลี่ยนสถานะนี้ได้';
  }
}

/** Admin confirming a pending booking — the moment the DO is issued. */
export function isConfirmTransition(from: string | null | undefined, to: string): boolean {
  return from === 'pending' && to === 'confirmed';
}

/** "เรียกคิว" — a repeat call counts (call_count goes up). */
export function isCallTransition(from: string | null | undefined, to: string): boolean {
  return to === 'called' && (from === 'checked_in' || from === 'called');
}

/** Gate check-in. */
export function isArrivalTransition(from: string | null | undefined, to: string): boolean {
  return to === 'checked_in' && (from === 'confirmed' || from === 'late');
}

/** Staff took the call back; the dock is free again but the truck is still in the yard. */
export function isUncallTransition(from: string | null | undefined, to: string): boolean {
  return from === 'called' && to === 'checked_in';
}

/**
 * Whether this move releases a dock, i.e. the next waiting vehicle may be auto-called.
 */
export function freesDock(from: string | null | undefined, to: string): boolean {
  if (!from || !(ON_DOCK_STATUSES as readonly string[]).includes(from)) return false;
  return to === 'completed' || to === 'no_show' || to === 'cancelled' || to === 'checked_in';
}

/**
 * Timestamp columns to stamp for a transition. Keys are `bookings` columns.
 *
 * @param from Current status.
 * @param to New status.
 * @param ctx.now Server clock.
 * @param ctx.actorId Portal user, or null for system / customer.
 * @param ctx.callCount Current `call_count`.
 * @param ctx.calledTimeoutMinutes `site_settings.called_timeout_minutes`.
 */
export function transitionStamps(
  from: string,
  to: string,
  ctx: { now: Date; actorId: string | null; callCount: number; calledTimeoutMinutes: number; auto?: boolean },
): Record<string, string | number | boolean | null> {
  const iso = ctx.now.toISOString();
  const out: Record<string, string | number | boolean | null> = {};
  if (isConfirmTransition(from, to)) {
    out.confirmed_at = iso;
    out.confirmed_by = ctx.actorId;
  }
  if (isArrivalTransition(from, to)) {
    out.arrived_at = iso;
    out.checked_in_at = iso;
  }
  if (isCallTransition(from, to)) {
    out.called_at = iso;
    out.called_by = ctx.actorId;
    out.call_count = ctx.callCount + 1;
    out.called_timeout_at = new Date(ctx.now.getTime() + ctx.calledTimeoutMinutes * 60_000).toISOString();
    out.auto_called = Boolean(ctx.auto);
  }
  if (isUncallTransition(from, to)) {
    out.called_at = null;
    out.called_timeout_at = null;
    out.auto_called = false;
  }
  if (to === 'serving') out.serving_started_at = iso;
  if (to === 'completed') out.completed_at = iso;
  if (to === 'cancelled') out.cancelled_by = ctx.actorId;
  return out;
}
