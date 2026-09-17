import type { createAdminClient } from '@/lib/supabase/admin';
import { safeCreateNotification } from '@/lib/notifications/createNotification';
import { checkInEligibility, type CheckInDenialReason } from '@/lib/booking/status-flow';

type AdminClient = ReturnType<typeof createAdminClient>;

export type CheckedInBooking = {
  id: string;
  queue_number: string | null;
  booking_date: string;
  start_time: string;
  branch_id: string | null;
};

export type CheckInResult =
  | { ok: true; booking: CheckedInBooking; already: boolean }
  | { ok: false; reason: 'line_user_not_found' | 'booking_not_found' | CheckInDenialReason };

/**
 * Customer declares arrival ("ฉันมาถึงแล้ว"): `confirmed` → `checked_in`,
 * stamps `checked_in_at`, logs it and pings the staff notification center.
 *
 * The booking must belong to the LINE user making the call — a forged booking
 * id from another customer resolves to `booking_not_found`. Eligibility (same
 * day, still waiting) lives in `checkInEligibility` so the LIFF button and any
 * future LINE postback share one rule.
 */
export async function checkInBookingByCustomer(
  admin: AdminClient,
  args: { shopId: string; companyId: string; externalLineUserId: string; bookingId: string; todayIso: string },
): Promise<CheckInResult> {
  const { data: lineUser } = await admin
    .from('line_users')
    .select('id')
    .eq('shop_id', args.shopId)
    .eq('line_user_id', args.externalLineUserId)
    .eq('is_deleted', false)
    .maybeSingle();
  if (!lineUser) return { ok: false, reason: 'line_user_not_found' };

  const { data: booking } = await admin
    .from('bookings')
    .select('id,queue_number,booking_date,start_time,branch_id,status')
    .eq('id', args.bookingId)
    .eq('shop_id', args.shopId)
    .eq('line_user_id', lineUser.id)
    .eq('is_deleted', false)
    .maybeSingle();
  if (!booking) return { ok: false, reason: 'booking_not_found' };

  const result: CheckedInBooking = {
    id: String(booking.id),
    queue_number: (booking.queue_number as string | null) ?? null,
    booking_date: String(booking.booking_date),
    start_time: String(booking.start_time),
    branch_id: (booking.branch_id as string | null) ?? null,
  };

  const eligibility = checkInEligibility({ status: String(booking.status), booking_date: result.booking_date }, args.todayIso);
  if (!eligibility.ok) {
    if (eligibility.reason === 'already_checked_in') return { ok: true, booking: result, already: true };
    return { ok: false, reason: eligibility.reason };
  }

  const { error } = await admin
    .from('bookings')
    .update({ status: 'checked_in', checked_in_at: new Date().toISOString() })
    .eq('id', booking.id)
    .eq('shop_id', args.shopId);
  if (error) throw error;

  await admin.from('booking_logs').insert({
    company_id: args.companyId,
    shop_id: args.shopId,
    booking_id: booking.id,
    action: 'check_in_by_customer_liff',
    description: `Customer checked in for ${result.queue_number ?? result.id}`,
  });

  await safeCreateNotification(admin, {
    companyId: args.companyId,
    shopId: args.shopId,
    branchId: result.branch_id,
    userId: null,
    type: 'booking_updated',
    category: 'bookings',
    priority: 'medium',
    title: `${result.queue_number ?? 'Queue'} — ลูกค้ามาถึงแล้ว`,
    message: `ลูกค้าเช็คอินคิว ${result.queue_number ?? ''} (${result.start_time.slice(0, 5)}) พร้อมให้เรียกคิว`,
    relatedType: 'booking',
    relatedId: result.id,
    actionUrl: '/portal/bookings',
    icon: 'HowToReg',
    color: '#7b1fa2',
    metadata: { checked_in: true },
    createdBy: null,
  });

  return { ok: true, booking: result, already: false };
}
