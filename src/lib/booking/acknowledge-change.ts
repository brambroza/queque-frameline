import type { createAdminClient } from '@/lib/supabase/admin';
import { safeCreateNotification } from '@/lib/notifications/createNotification';

type AdminClient = ReturnType<typeof createAdminClient>;

export type AcknowledgedBooking = {
  id: string;
  queue_number: string | null;
  booking_date: string;
  start_time: string;
  branch_id: string | null;
};

export type AcknowledgeResult =
  | { ok: true; booking: AcknowledgedBooking; already: boolean }
  | { ok: false; reason: 'line_user_not_found' | 'booking_not_found' };

/**
 * Record that the customer saw a shop-initiated change. Shared by the LINE
 * postback handler and the LIFF account tab so both paths behave the same.
 *
 * The booking must belong to the LINE user making the call — a forged
 * booking id from another customer resolves to `booking_not_found`.
 */
export async function acknowledgeBookingChange(
  admin: AdminClient,
  args: { shopId: string; companyId: string; externalLineUserId: string; bookingId: string },
): Promise<AcknowledgeResult> {
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
    .select('id,queue_number,booking_date,start_time,branch_id,change_notified_at,change_acknowledged_at')
    .eq('id', args.bookingId)
    .eq('shop_id', args.shopId)
    .eq('line_user_id', lineUser.id)
    .eq('is_deleted', false)
    .maybeSingle();
  if (!booking) return { ok: false, reason: 'booking_not_found' };

  const notifiedAt = booking.change_notified_at ? new Date(String(booking.change_notified_at)).getTime() : 0;
  const ackedAt = booking.change_acknowledged_at ? new Date(String(booking.change_acknowledged_at)).getTime() : 0;
  const already = notifiedAt > 0 && ackedAt >= notifiedAt;

  const result: AcknowledgedBooking = {
    id: String(booking.id),
    queue_number: (booking.queue_number as string | null) ?? null,
    booking_date: String(booking.booking_date),
    start_time: String(booking.start_time),
    branch_id: (booking.branch_id as string | null) ?? null,
  };
  if (already) return { ok: true, booking: result, already: true };

  await admin
    .from('bookings')
    .update({ change_acknowledged_at: new Date().toISOString() })
    .eq('id', booking.id)
    .eq('shop_id', args.shopId);

  await admin.from('booking_logs').insert({
    company_id: args.companyId,
    shop_id: args.shopId,
    booking_id: booking.id,
    action: 'ack_change_by_customer',
    description: `Customer acknowledged change on ${result.queue_number ?? result.id}`,
  });

  await safeCreateNotification(admin, {
    companyId: args.companyId,
    shopId: args.shopId,
    branchId: result.branch_id,
    userId: null,
    type: 'booking_updated',
    category: 'bookings',
    priority: 'low',
    title: `${result.queue_number ?? 'Queue'} — ลูกค้ารับทราบแล้ว`,
    message: `ลูกค้ารับทราบการเปลี่ยนแปลงคิว ${result.queue_number ?? ''} (${result.booking_date} ${result.start_time.slice(0, 5)})`,
    relatedType: 'booking',
    relatedId: result.id,
    actionUrl: '/portal/bookings',
    icon: 'TaskAlt',
    color: '#2e7d32',
    metadata: { acknowledged: true },
    createdBy: null,
  });

  return { ok: true, booking: result, already: false };
}
