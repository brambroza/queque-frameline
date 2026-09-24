/**
 * LINE push side-effects. Every function here NEVER throws: it returns
 * `{ sent, reason }` and writes the outcome to the booking audit log, so a LINE
 * outage or an unlinked user cannot fail a confirmation or a gate action.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { BookingDirection } from '@/types/db';
import { pushMessage } from './client';
import { getLineConfig, isLineConfigured, liffUrl, type LineConfig } from './config';
import {
  bookingCalledFlex, bookingCancelledFlex, bookingConfirmedFlex, bookingLateFlex, bookingRescheduledFlex, bookingSubmittedFlex, bookingWaitingFlex, driverJobFlex, noShowFlex, paymentWarningFlex, staffGroupText,
  type BookingInput, type CancelledBy, type StaffEvent,
} from './messages';
import { deriveLinkToken } from '@/lib/tokens';
import { bookingUrl, driverUrl } from '@/lib/links';
import { effectivePlate } from '@/lib/booking/plate';
import { getSiteSettings, logBooking } from '@/lib/booking/server';
import { isPaymentCleared } from '@/lib/booking/payment';

export type NotifyResult = { sent: boolean; reason?: 'not_configured' | 'disabled' | 'not_linked' | 'not_found' | 'push_failed' | 'no_group' };

export type PartnerKind = 'submitted' | 'confirmed' | 'called' | 'late' | 'rescheduled' | 'cancelled' | 'no_show' | 'payment_warning';
export type DriverKind = 'job' | 'called' | 'waiting' | 'late';

/** `late` needs the site's grace rule to say how long the driver still has. */
async function lateFacts(admin: SupabaseClient, shopId: string): Promise<{ graceMinutes: number; autoNoShow: boolean }> {
  const s = await getSiteSettings(admin, shopId);
  return { graceMinutes: s.grace_minutes, autoNoShow: s.auto_no_show_after_grace };
}

type BookingRowForLine = {
  id: string; company_id: string; shop_id: string; queue_number: string; direction: BookingDirection; booking_date: string; start_time: string; end_time: string | null;
  resource_name: string | null; plate_number: string | null; plate_number_actual: string | null; do_number: string | null; call_count: number | null;
  cancel_reason: string | null; customer_id: string | null; line_user_id: string | null; driver_line_user_id: string | null;
  driver_token_hash: string | null; driver_token_version: number | null;
  services: { service_name: string } | null;
  external_documents: { id: string; doc_no: string; doc_type: string | null; payment_status: string | null; booking_token_hash: string | null; booking_token_version: number | null } | null;
  customers: { line_user_id: string | null } | null;
};

const BOOKING_SELECT =
  'id,company_id,shop_id,queue_number,direction,booking_date,start_time,end_time,resource_name,plate_number,plate_number_actual,do_number,call_count,cancel_reason,customer_id,line_user_id,driver_line_user_id,driver_token_hash,driver_token_version,services(service_name),external_documents(id,doc_no,doc_type,payment_status,booking_token_hash,booking_token_version),customers(line_user_id)';

async function loadBooking(admin: SupabaseClient, shopId: string, bookingId: string): Promise<BookingRowForLine | null> {
  const { data } = await admin.from('bookings').select(BOOKING_SELECT).eq('id', bookingId).eq('shop_id', shopId).maybeSingle();
  return (data as unknown as BookingRowForLine | null) ?? null;
}

async function siteName(admin: SupabaseClient, shopId: string): Promise<string> {
  const { data } = await admin.from('shops').select('name').eq('id', shopId).maybeSingle();
  return (data?.name as string | undefined) || 'Fameline';
}

/** LINE user id (Uxxxx) behind a `line_users` row id. */
async function lineUserId(admin: SupabaseClient, shopId: string, rowId: string | null): Promise<string | null> {
  if (!rowId) return null;
  const { data } = await admin.from('line_users').select('line_user_id').eq('id', rowId).eq('shop_id', shopId).eq('is_deleted', false).maybeSingle();
  return (data?.line_user_id as string | undefined) ?? null;
}

/** Links for the customer: LIFF form when a LIFF app exists (so they stay in LINE), plain web otherwise. */
function linksFor(cfg: LineConfig, b: BookingRowForLine): { statusUrl: string; driverUrl: string | null } {
  const doc = b.external_documents;
  const bookingToken = doc?.booking_token_hash ? deriveLinkToken('booking', doc.id, Number(doc.booking_token_version ?? 0)) : null;
  const driverToken = b.driver_token_hash ? deriveLinkToken('driver', b.id, Number(b.driver_token_version ?? 0)) : null;
  const status = bookingToken ? liffUrl(cfg, `/book/${bookingToken}`) ?? bookingUrl(bookingToken) : bookingUrl('');
  const driver = driverToken ? liffUrl(cfg, `/driver/${driverToken}`) ?? driverUrl(driverToken) : null;
  return { statusUrl: status, driverUrl: driver };
}

function toInput(cfg: LineConfig, site: string, b: BookingRowForLine): BookingInput {
  const links = linksFor(cfg, b);
  return {
    siteName: site,
    queueNo: b.queue_number,
    direction: b.direction,
    docNo: b.external_documents?.doc_no ?? null,
    date: String(b.booking_date),
    startTime: String(b.start_time),
    endTime: b.end_time ? String(b.end_time) : null,
    dock: b.resource_name,
    plate: effectivePlate(b) || '-',
    vehicleType: b.services?.service_name ?? null,
    doNo: b.do_number,
    statusUrl: links.statusUrl,
    driverUrl: links.driverUrl,
    paymentPending: !isPaymentCleared(b.external_documents?.doc_type, b.external_documents?.payment_status),
  };
}

async function record(admin: SupabaseClient, b: Pick<BookingRowForLine, 'id' | 'company_id' | 'shop_id' | 'queue_number'>, target: string, kind: string, result: NotifyResult) {
  await logBooking(admin, {
    companyId: b.company_id, shopId: b.shop_id, bookingId: b.id, action: 'line_push',
    description: `${b.queue_number}: LINE → ${target} (${kind}) ${result.sent ? 'ส่งแล้ว' : `ไม่ส่ง: ${result.reason}`}`,
    to: { target, kind, sent: result.sent, reason: result.reason ?? null }, actorKind: 'system',
  });
  if (result.sent) await admin.from('bookings').update({ last_line_notify_at: new Date().toISOString() }).eq('id', b.id);
}

async function push(cfg: LineConfig & { channel_access_token: string }, to: string, messages: object[]): Promise<NotifyResult> {
  try {
    await pushMessage(cfg.channel_access_token, to, messages);
    return { sent: true };
  } catch (e) {
    console.error('[line] push failed:', e instanceof Error ? e.message : e);
    return { sent: false, reason: 'push_failed' };
  }
}

/**
 * Notify the customer / supplier of a booking. Prefers the LINE user who made
 * the booking (`bookings.line_user_id`), else the partner's linked user.
 */
export async function safeNotifyPartner(
  admin: SupabaseClient,
  args: {
    shopId: string; bookingId: string; kind: PartnerKind; prev?: { date: string; time: string }; byCustomer?: boolean;
    /** `cancelled`: who did it (defaults to staff, or customer when `byCustomer`). */
    by?: CancelledBy;
    /** `submitted` / `payment_warning`: ISO instant the unpaid queue is auto-cancelled. */
    dueAt?: string | null;
  },
): Promise<NotifyResult> {
  try {
    const cfg = await getLineConfig(admin, args.shopId);
    if (!isLineConfigured(cfg)) return { sent: false, reason: 'not_configured' };
    const b = await loadBooking(admin, args.shopId, args.bookingId);
    if (!b) return { sent: false, reason: 'not_found' };
    if (!cfg.notify_customer) return { sent: false, reason: 'disabled' };

    const to = (await lineUserId(admin, args.shopId, b.line_user_id)) ?? (await lineUserId(admin, args.shopId, b.customers?.line_user_id ?? null));
    if (!to) { const r: NotifyResult = { sent: false, reason: 'not_linked' }; await record(admin, b, 'partner', args.kind, r); return r; }

    const input = toInput(cfg, await siteName(admin, args.shopId), b);
    const message =
      args.kind === 'submitted' ? bookingSubmittedFlex({ ...input, paymentDueAt: args.dueAt ?? null })
      : args.kind === 'payment_warning' ? paymentWarningFlex({ ...input, dueAt: args.dueAt ?? new Date().toISOString() })
      : args.kind === 'confirmed' ? bookingConfirmedFlex(input)
      : args.kind === 'called' ? bookingCalledFlex({ ...input, callCount: b.call_count })
      : args.kind === 'late' ? bookingLateFlex({ ...input, ...(await lateFacts(admin, args.shopId)), who: 'partner' })
      : args.kind === 'rescheduled' ? bookingRescheduledFlex({ ...input, prevDate: args.prev?.date ?? input.date, prevTime: args.prev?.time ?? input.startTime })
      : args.kind === 'cancelled' ? bookingCancelledFlex({ ...input, reason: b.cancel_reason, byCustomer: args.byCustomer, by: args.by })
      : noShowFlex(input);
    const r = await push(cfg, to, [message]);
    await record(admin, b, 'partner', args.kind, r);
    return r;
  } catch (e) {
    console.error('[line] notify partner failed:', e instanceof Error ? e.message : e);
    return { sent: false, reason: 'push_failed' };
  }
}

/** Notify the driver bound to this booking (job card on confirm, "ถึงคิวแล้ว" on call, "กรุณารอสักครู่" when the dock runs late, "เลยเวลานัด" when late). */
export async function safeNotifyDriver(admin: SupabaseClient, args: { shopId: string; bookingId: string; kind: DriverKind }): Promise<NotifyResult> {
  try {
    const cfg = await getLineConfig(admin, args.shopId);
    if (!isLineConfigured(cfg)) return { sent: false, reason: 'not_configured' };
    const b = await loadBooking(admin, args.shopId, args.bookingId);
    if (!b) return { sent: false, reason: 'not_found' };
    if (!cfg.notify_driver) return { sent: false, reason: 'disabled' };
    const to = await lineUserId(admin, args.shopId, b.driver_line_user_id);
    if (!to) { const r: NotifyResult = { sent: false, reason: 'not_linked' }; await record(admin, b, 'driver', args.kind, r); return r; }

    const input = toInput(cfg, await siteName(admin, args.shopId), b);
    const message = args.kind === 'called'
      ? bookingCalledFlex({ ...input, callCount: b.call_count })
      : args.kind === 'late'
        ? bookingLateFlex({ ...input, ...(await lateFacts(admin, args.shopId)), who: 'driver' })
        : args.kind === 'waiting'
          ? bookingWaitingFlex(input)
          : driverJobFlex({ ...input, driverUrl: input.driverUrl ?? input.statusUrl });
    const r = await push(cfg, to, [message]);
    await record(admin, b, 'driver', args.kind, r);
    return r;
  } catch (e) {
    console.error('[line] notify driver failed:', e instanceof Error ? e.message : e);
    return { sent: false, reason: 'push_failed' };
  }
}

/** One-line message to the registered warehouse-team group. */
export async function safeNotifyStaffGroup(admin: SupabaseClient, args: { shopId: string; event: StaffEvent; bookingId?: string }): Promise<NotifyResult> {
  try {
    const cfg = await getLineConfig(admin, args.shopId);
    if (!isLineConfigured(cfg)) return { sent: false, reason: 'not_configured' };
    if (!cfg.notify_staff_group) return { sent: false, reason: 'disabled' };
    if (!cfg.staff_group_id) return { sent: false, reason: 'no_group' };
    const r = await push(cfg, cfg.staff_group_id, [staffGroupText(args.event)]);
    if (args.bookingId) {
      const { data: b } = await admin.from('bookings').select('id,company_id,shop_id,queue_number').eq('id', args.bookingId).eq('shop_id', args.shopId).maybeSingle();
      if (b) await record(admin, b as Pick<BookingRowForLine, 'id' | 'company_id' | 'shop_id' | 'queue_number'>, 'staff_group', args.event.kind, r);
    }
    return r;
  } catch (e) {
    console.error('[line] notify group failed:', e instanceof Error ? e.message : e);
    return { sent: false, reason: 'push_failed' };
  }
}
