/**
 * Web Push side-effects for the driver page. Never throws: returns a count and
 * a reason, writes the outcome to the booking audit log (`web_push`), and
 * soft-deletes subscriptions the push service reports as gone (404 / 410).
 * A push outage or an unsubscribed driver cannot fail a gate action.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import webpush from 'web-push';
import { getPushConfig, type PushConfig } from './config';
import { driverAlert, type DriverAlertKind, type DriverPushPayload } from './driver-alerts';
import { deriveLinkToken } from '@/lib/tokens';
import { driverUrl } from '@/lib/links';
import { getSiteSettings, logBooking } from '@/lib/booking/server';

export type PushNotifyResult = { sent: number; failed: number; reason?: 'not_configured' | 'not_found' | 'no_subscription' };

type SubscriptionRow = { id: string; endpoint: string; p256dh: string; auth: string };

type BookingRowForPush = {
  id: string; company_id: string; shop_id: string; queue_number: string; resource_name: string | null; call_count: number | null;
  driver_token_hash: string | null; driver_token_version: number | null;
};

/** Seconds the push service keeps an undelivered message. A call is useless after the called timeout anyway. */
const TTL_SECONDS = 15 * 60;

let configured: string | null = null;

function ensureVapid(cfg: PushConfig) {
  const key = `${cfg.subject}|${cfg.publicKey}`;
  if (configured === key) return;
  webpush.setVapidDetails(cfg.subject, cfg.publicKey, cfg.privateKey);
  configured = key;
}

function statusCodeOf(e: unknown): number | null {
  if (!e || typeof e !== 'object') return null;
  const code = (e as { statusCode?: unknown }).statusCode;
  return typeof code === 'number' ? code : null;
}

/**
 * Push the event to every browser subscribed on this booking's driver link.
 *
 * @param admin Service-role client.
 * @param args.kind Event; `called` / `late` are the ones the queue flow sends.
 */
export async function safeNotifyDriverPush(
  admin: SupabaseClient,
  args: { shopId: string; bookingId: string; kind: DriverAlertKind },
): Promise<PushNotifyResult> {
  try {
    const cfg = getPushConfig();
    if (!cfg) return { sent: 0, failed: 0, reason: 'not_configured' };

    const { data: subs } = await admin
      .from('push_subscriptions')
      .select('id,endpoint,p256dh,auth')
      .eq('booking_id', args.bookingId)
      .eq('shop_id', args.shopId)
      .eq('is_deleted', false);
    const rows = (subs ?? []) as SubscriptionRow[];
    if (rows.length === 0) return { sent: 0, failed: 0, reason: 'no_subscription' };

    const { data: booking } = await admin
      .from('bookings')
      .select('id,company_id,shop_id,queue_number,resource_name,call_count,driver_token_hash,driver_token_version')
      .eq('id', args.bookingId)
      .eq('shop_id', args.shopId)
      .maybeSingle();
    const b = (booking as BookingRowForPush | null) ?? null;
    if (!b) return { sent: 0, failed: 0, reason: 'not_found' };

    const settings = args.kind === 'late' ? await getSiteSettings(admin, args.shopId) : null;
    const alert = driverAlert(args.kind, b.id, {
      queueNo: b.queue_number,
      dock: b.resource_name,
      callCount: b.call_count,
      graceMinutes: settings?.grace_minutes ?? null,
      autoNoShow: settings?.auto_no_show_after_grace ?? false,
    });
    const token = b.driver_token_hash ? deriveLinkToken('driver', b.id, Number(b.driver_token_version ?? 0)) : null;
    const payload: DriverPushPayload = { ...alert, url: token ? driverUrl(token) : '/' };
    const body = JSON.stringify(payload);

    ensureVapid(cfg);
    let sent = 0;
    let failed = 0;
    const now = new Date().toISOString();
    for (const s of rows) {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body, { TTL: TTL_SECONDS, urgency: 'high' });
        sent += 1;
        await admin.from('push_subscriptions').update({ last_sent_at: now, last_error: null }).eq('id', s.id);
      } catch (e) {
        failed += 1;
        const code = statusCodeOf(e);
        const gone = code === 404 || code === 410;
        // Endpoint text is a capability URL: never log it.
        console.warn('[web_push] send failed', { booking: b.queue_number, code: code ?? 'n/a', gone });
        await admin.from('push_subscriptions').update({ last_error: gone ? 'gone' : code ? `http_${code}` : 'send_failed', ...(gone ? { is_deleted: true } : {}) }).eq('id', s.id);
      }
    }

    await logBooking(admin, {
      companyId: b.company_id, shopId: b.shop_id, bookingId: b.id, action: 'web_push',
      description: `${b.queue_number}: push → คนขับ (${args.kind}) ส่งแล้ว ${sent}${failed ? ` · ไม่สำเร็จ ${failed}` : ''}`,
      to: { kind: args.kind, sent, failed }, actorKind: 'system',
    });
    return { sent, failed };
  } catch (e) {
    console.error('[web_push] notify failed:', e instanceof Error ? e.message : e);
    return { sent: 0, failed: 0 };
  }
}
