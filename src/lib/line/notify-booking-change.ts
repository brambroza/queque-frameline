import { createAdminClient } from '@/lib/supabase/admin';
import { pushMessage } from '@/lib/line/client';
import { bookingCancelledFlex, bookingChangedFlex } from '@/lib/line/messages';
import { formatThaiDateLabel } from '@/lib/utils/date-format';
import { resourceTypeLabel } from '@/lib/booking/resource-types';

export type BookingChangeKind = 'moved' | 'reassigned' | 'cancelled';

export type BookingChangeNotifyArgs = {
  shopId: string;
  bookingId: string;
  kind: BookingChangeKind;
  /** Slot / provider before the change, used for the "เดิม → ใหม่" lines. */
  prev: { booking_date: string; start_time: string; resource_name?: string | null };
  /** Resource type after the change (or before, when removed) for the Thai label. */
  resourceType?: string | null;
};

export type BookingChangeNotifyResult = { sent: boolean; reason?: 'no_line_user' | 'no_token' | 'not_found' | 'push_failed'; error?: string };

type BookingForNotice = {
  id: string;
  queue_number: string | null;
  booking_date: string;
  start_time: string;
  line_user_id: string | null;
  resource_name: string | null;
  branches: { branch_name?: string | null } | { branch_name?: string | null }[] | null;
  services: { service_name?: string | null } | { service_name?: string | null }[] | null;
};

/** Supabase returns embedded rows as object or array depending on the relation shape. */
function one<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? v[0] ?? null : v;
}

/** Minimal client surface so tests can pass a stub instead of the real admin client. */
export type NotifyClient = ReturnType<typeof createAdminClient>;

type Deps = { admin?: NotifyClient; push?: typeof pushMessage };

/**
 * Push a LINE notice to the customer after a shop-initiated change. Never throws:
 * a walk-in booking without a LINE user, a shop without a token, or a LINE API
 * failure all resolve to `{ sent: false }` so the booking update itself stands.
 *
 * Server-only: uses the service-role client. Call from authenticated routes only.
 */
export async function safeNotifyBookingChange(args: BookingChangeNotifyArgs, deps: Deps = {}): Promise<BookingChangeNotifyResult> {
  try {
    const admin = deps.admin ?? createAdminClient();
    const push = deps.push ?? pushMessage;

    const { data: bookingRaw } = await admin
      .from('bookings')
      .select('id,queue_number,booking_date,start_time,line_user_id,resource_name,branches(branch_name),services(service_name)')
      .eq('id', args.bookingId)
      .eq('shop_id', args.shopId)
      .maybeSingle();
    const booking = bookingRaw as BookingForNotice | null;
    if (!booking) return { sent: false, reason: 'not_found' };
    if (!booking.line_user_id) return { sent: false, reason: 'no_line_user' };

    const [{ data: lineUser }, { data: shop }] = await Promise.all([
      admin.from('line_users').select('line_user_id').eq('id', booking.line_user_id).eq('shop_id', args.shopId).maybeSingle(),
      admin.from('shops').select('name,shop_key,line_channel_access_token').eq('id', args.shopId).maybeSingle(),
    ]);
    const externalLineId = (lineUser as { line_user_id?: string | null } | null)?.line_user_id ?? null;
    if (!externalLineId) return { sent: false, reason: 'no_line_user' };

    const token = (shop as { line_channel_access_token?: string | null } | null)?.line_channel_access_token || process.env.LINE_CHANNEL_ACCESS_TOKEN || '';
    if (!token) return { sent: false, reason: 'no_token' };

    const shopName = (shop as { name?: string | null } | null)?.name ?? 'Queue Booking';
    const shopKey = (shop as { shop_key?: string | null } | null)?.shop_key ?? null;
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/+$/, '');
    const liffUrl = shopKey && appUrl ? `${appUrl}/liff/${encodeURIComponent(shopKey)}` : undefined;

    const queueNumber = booking.queue_number ?? '-';
    const branch = one(booking.branches)?.branch_name ?? '-';
    const service = one(booking.services)?.service_name ?? '-';

    const message =
      args.kind === 'cancelled'
        ? bookingCancelledFlex({
            shopName,
            queueNumber,
            branch,
            service,
            date: formatThaiDateLabel(booking.booking_date),
            time: String(booking.start_time).slice(0, 5),
            liffUrl,
          })
        : bookingChangedFlex({
            shopName,
            queueNumber,
            bookingId: booking.id,
            branch,
            service,
            prevDate: formatThaiDateLabel(args.prev.booking_date),
            prevTime: String(args.prev.start_time).slice(0, 5),
            newDate: formatThaiDateLabel(booking.booking_date),
            newTime: String(booking.start_time).slice(0, 5),
            reassignedOnly: args.kind === 'reassigned',
            prevAssignedTo: args.prev.resource_name ?? null,
            assignedTo: booking.resource_name ?? null,
            assignedLabel: resourceTypeLabel(args.resourceType),
            liffUrl,
          });

    try {
      await push(token, externalLineId, [message]);
    } catch (e) {
      return { sent: false, reason: 'push_failed', error: e instanceof Error ? e.message : 'LINE push failed' };
    }

    // A cancelled booking has nothing left to acknowledge.
    if (args.kind !== 'cancelled') {
      await admin
        .from('bookings')
        .update({ change_notified_at: new Date().toISOString() })
        .eq('id', booking.id)
        .eq('shop_id', args.shopId);
    }
    return { sent: true };
  } catch (e) {
    return { sent: false, reason: 'push_failed', error: e instanceof Error ? e.message : 'notify failed' };
  }
}
