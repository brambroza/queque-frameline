import type { SupabaseClient } from '@supabase/supabase-js';
import { pushMessage } from '@/lib/line/client';
import { paymentReceiptFlex } from '@/lib/line/messages-payment';
import { formatThaiDateLabel } from '@/lib/utils/date-format';

/**
 * Push the LINE receipt for a booking that has just been marked paid.
 *
 * Non-critical by design: the payment is already recorded when this runs, so
 * every failure is swallowed. Returns true when a message was actually sent.
 */
export async function pushPaymentReceipt(
  admin: SupabaseClient,
  opts: { bookingId: string; shopId: string; receiptRef: string; paidAt: string },
): Promise<boolean> {
  try {
    const { data: booking } = await admin
      .from('bookings')
      .select(`
        id, queue_number, booking_date, start_time, payment_amount, line_user_id,
        branches(branch_name),
        services(service_name),
        shops(name, line_channel_access_token)
      `)
      .eq('id', opts.bookingId)
      .eq('shop_id', opts.shopId)
      .maybeSingle();
    if (!booking) return false;

    const shop = booking.shops as unknown as { name: string | null; line_channel_access_token: string | null } | null;
    const lineToken = shop?.line_channel_access_token || process.env.LINE_CHANNEL_ACCESS_TOKEN || '';
    const lineUserPk = booking.line_user_id as string | null;
    if (!lineToken || !lineUserPk) return false;

    const { data: lineUser } = await admin
      .from('line_users')
      .select('line_user_id')
      .eq('id', lineUserPk)
      .maybeSingle();
    const externalLineId = lineUser?.line_user_id as string | null | undefined;
    if (!externalLineId) return false;

    const branches = booking.branches as unknown as { branch_name: string } | null;
    const services = booking.services as unknown as { service_name: string } | null;
    await pushMessage(lineToken, externalLineId, [
      paymentReceiptFlex({
        shopName: shop?.name ?? 'Queue Booking',
        queueNumber: booking.queue_number as string,
        service: services?.service_name ?? '-',
        branch: branches?.branch_name ?? '-',
        date: formatThaiDateLabel(booking.booking_date as string),
        time: String(booking.start_time ?? '').slice(0, 5),
        amountTHB: Number(booking.payment_amount ?? 0),
        receiptRef: opts.receiptRef,
        paidAt: opts.paidAt,
      }),
    ]);
    return true;
  } catch {
    return false;
  }
}
