import { createAdminClient } from '@/lib/supabase/admin';
import { pushMessage } from '@/lib/line/client';
import { bookingApprovedFlex, bookingCalledFlex } from '@/lib/line/messages';
import { formatThaiDateLabel } from '@/lib/utils/date-format';
import { resourceTypeLabel } from '@/lib/booking/resource-types';

/**
 * `called`   — staff pressed "เรียกคิว": it is the customer's turn now.
 * `approved` — staff confirmed a `pending_approval` booking.
 */
export type BookingStatusNoticeKind = 'called' | 'approved';

export type BookingStatusNotifyArgs = {
  shopId: string;
  bookingId: string;
  kind: BookingStatusNoticeKind;
  /** How many times this booking has been called including this one (`called` only). */
  callCount?: number;
};

export type BookingStatusNotifyResult = {
  sent: boolean;
  reason?: 'no_line_user' | 'no_token' | 'not_found' | 'push_failed';
  error?: string;
};

type BookingForNotice = {
  id: string;
  queue_number: string | null;
  booking_date: string;
  start_time: string;
  line_user_id: string | null;
  resource_id: string | null;
  resource_name: string | null;
  branches: { branch_name?: string | null } | { branch_name?: string | null }[] | null;
  services: { service_name?: string | null } | { service_name?: string | null }[] | null;
};

/** Supabase returns embedded rows as object or array depending on the relation shape. */
function one<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? v[0] ?? null : v;
}

/** Minimal client surface so tests can pass a stub instead of the real admin client. */
export type StatusNotifyClient = ReturnType<typeof createAdminClient>;

type Deps = { admin?: StatusNotifyClient; push?: typeof pushMessage; now?: () => Date };

/**
 * Push a LINE notice to the customer when their booking is called or approved.
 * Never throws: a walk-in without LINE, a shop without a token or a LINE API
 * failure all resolve to `{ sent: false }` so the status change itself stands.
 *
 * A successful push stamps `bookings.last_line_notify_at`.
 *
 * Server-only: uses the service-role client. Call from authenticated routes only.
 */
export async function safeNotifyBookingStatus(args: BookingStatusNotifyArgs, deps: Deps = {}): Promise<BookingStatusNotifyResult> {
  try {
    const admin = deps.admin ?? createAdminClient();
    const push = deps.push ?? pushMessage;
    const now = deps.now ?? (() => new Date());

    const { data: bookingRaw } = await admin
      .from('bookings')
      .select('id,queue_number,booking_date,start_time,line_user_id,resource_id,resource_name,branches(branch_name),services(service_name)')
      .eq('id', args.bookingId)
      .eq('shop_id', args.shopId)
      .maybeSingle();
    const booking = bookingRaw as BookingForNotice | null;
    if (!booking) return { sent: false, reason: 'not_found' };
    if (!booking.line_user_id) return { sent: false, reason: 'no_line_user' };

    const [{ data: lineUser }, { data: shop }, { data: resource }] = await Promise.all([
      admin.from('line_users').select('line_user_id').eq('id', booking.line_user_id).eq('shop_id', args.shopId).maybeSingle(),
      admin.from('shops').select('name,shop_key,line_channel_access_token').eq('id', args.shopId).maybeSingle(),
      booking.resource_id
        ? admin.from('booking_resources').select('resource_type').eq('id', booking.resource_id).eq('shop_id', args.shopId).maybeSingle()
        : Promise.resolve({ data: null as { resource_type?: string | null } | null }),
    ]);
    const externalLineId = (lineUser as { line_user_id?: string | null } | null)?.line_user_id ?? null;
    if (!externalLineId) return { sent: false, reason: 'no_line_user' };

    const token = (shop as { line_channel_access_token?: string | null } | null)?.line_channel_access_token || process.env.LINE_CHANNEL_ACCESS_TOKEN || '';
    if (!token) return { sent: false, reason: 'no_token' };

    const shopName = (shop as { name?: string | null } | null)?.name ?? 'Queue Booking';
    const shopKey = (shop as { shop_key?: string | null } | null)?.shop_key ?? null;
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/+$/, '');
    const liffUrl = shopKey && appUrl ? `${appUrl}/liff/${encodeURIComponent(shopKey)}` : undefined;

    const common = {
      shopName,
      queueNumber: booking.queue_number ?? '-',
      branch: one(booking.branches)?.branch_name ?? '-',
      service: one(booking.services)?.service_name ?? '-',
      assignedTo: booking.resource_name ?? null,
      assignedLabel: booking.resource_name ? resourceTypeLabel((resource as { resource_type?: string | null } | null)?.resource_type ?? null) : null,
      liffUrl,
    };

    const message =
      args.kind === 'called'
        ? bookingCalledFlex({ ...common, callCount: Math.max(1, args.callCount ?? 1) })
        : bookingApprovedFlex({
            ...common,
            date: formatThaiDateLabel(booking.booking_date),
            time: String(booking.start_time).slice(0, 5),
          });

    try {
      await push(token, externalLineId, [message]);
    } catch (e) {
      return { sent: false, reason: 'push_failed', error: e instanceof Error ? e.message : 'LINE push failed' };
    }

    await admin
      .from('bookings')
      .update({ last_line_notify_at: now().toISOString() })
      .eq('id', booking.id)
      .eq('shop_id', args.shopId);
    return { sent: true };
  } catch (e) {
    return { sent: false, reason: 'push_failed', error: e instanceof Error ? e.message : 'notify failed' };
  }
}
