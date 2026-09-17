import { createAdminClient } from '@/lib/supabase/admin';
import { pushMessage } from '@/lib/line/client';
import { bookingReminderFlex } from '@/lib/line/messages';
import { formatThaiDateLabel } from '@/lib/utils/date-format';

export type BookingReminderArgs = {
  shopId: string;
  bookingId: string;
  /** Lead time the shop configured, shown in the message ("อีก 30 นาที"). */
  minutesBefore: number;
};

export type BookingReminderResult = {
  sent: boolean;
  reason?: 'no_line_user' | 'no_token' | 'not_found' | 'already_sent' | 'push_failed';
  error?: string;
};

type BookingForReminder = {
  id: string;
  queue_number: string | null;
  booking_date: string;
  start_time: string;
  line_user_id: string | null;
  reminder_sent_at: string | null;
  resource_name: string | null;
  branches: { branch_name?: string | null } | { branch_name?: string | null }[] | null;
  services: { service_name?: string | null } | { service_name?: string | null }[] | null;
};

/** Supabase returns embedded rows as object or array depending on the relation shape. */
function one<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? v[0] ?? null : v;
}

/** Minimal client surface so tests can pass a stub instead of the real admin client. */
export type ReminderClient = ReturnType<typeof createAdminClient>;

type Deps = { admin?: ReminderClient; push?: typeof pushMessage; now?: () => Date };

/**
 * Push a "your booking starts soon" LINE notice for one booking. Never throws.
 *
 * `reminder_sent_at` is stamped after a successful push, and also when the
 * booking can never be reached (no LINE user, no channel token) so the cron
 * does not re-select it every tick. A transient LINE failure leaves the flag
 * null so the next tick retries.
 *
 * Server-only: uses the service-role client. Call from the cron route only.
 */
export async function safeNotifyBookingReminder(args: BookingReminderArgs, deps: Deps = {}): Promise<BookingReminderResult> {
  try {
    const admin = deps.admin ?? createAdminClient();
    const push = deps.push ?? pushMessage;
    const now = deps.now ?? (() => new Date());

    const stamp = async () => {
      await admin
        .from('bookings')
        .update({ reminder_sent_at: now().toISOString() })
        .eq('id', args.bookingId)
        .eq('shop_id', args.shopId);
    };

    const { data: bookingRaw } = await admin
      .from('bookings')
      .select('id,queue_number,booking_date,start_time,line_user_id,reminder_sent_at,resource_name,branches(branch_name),services(service_name)')
      .eq('id', args.bookingId)
      .eq('shop_id', args.shopId)
      .maybeSingle();
    const booking = bookingRaw as BookingForReminder | null;
    if (!booking) return { sent: false, reason: 'not_found' };
    if (booking.reminder_sent_at) return { sent: false, reason: 'already_sent' };
    if (!booking.line_user_id) {
      await stamp();
      return { sent: false, reason: 'no_line_user' };
    }

    const [{ data: lineUser }, { data: shop }] = await Promise.all([
      admin.from('line_users').select('line_user_id').eq('id', booking.line_user_id).eq('shop_id', args.shopId).maybeSingle(),
      admin.from('shops').select('name,shop_key,line_channel_access_token').eq('id', args.shopId).maybeSingle(),
    ]);
    const externalLineId = (lineUser as { line_user_id?: string | null } | null)?.line_user_id ?? null;
    if (!externalLineId) {
      await stamp();
      return { sent: false, reason: 'no_line_user' };
    }

    const token = (shop as { line_channel_access_token?: string | null } | null)?.line_channel_access_token || process.env.LINE_CHANNEL_ACCESS_TOKEN || '';
    if (!token) {
      await stamp();
      return { sent: false, reason: 'no_token' };
    }

    const shopName = (shop as { name?: string | null } | null)?.name ?? 'Queue Booking';
    const shopKey = (shop as { shop_key?: string | null } | null)?.shop_key ?? null;
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/+$/, '');
    const liffUrl = shopKey && appUrl ? `${appUrl}/liff/${encodeURIComponent(shopKey)}` : undefined;

    const message = bookingReminderFlex({
      shopName,
      queueNumber: booking.queue_number ?? '-',
      branch: one(booking.branches)?.branch_name ?? '-',
      service: one(booking.services)?.service_name ?? '-',
      date: formatThaiDateLabel(booking.booking_date),
      time: String(booking.start_time).slice(0, 5),
      assignedTo: booking.resource_name ?? null,
      minutesBefore: args.minutesBefore,
      liffUrl,
    });

    try {
      await push(token, externalLineId, [message]);
    } catch (e) {
      return { sent: false, reason: 'push_failed', error: e instanceof Error ? e.message : 'LINE push failed' };
    }

    await stamp();
    return { sent: true };
  } catch (e) {
    return { sent: false, reason: 'push_failed', error: e instanceof Error ? e.message : 'reminder failed' };
  }
}
