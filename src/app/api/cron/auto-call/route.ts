import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { computeOverdueMoves, computeWaitNotices } from '@/lib/booking/overdue';
import { computeUnpaidActions, paymentDeadline, type UnpaidCandidate } from '@/lib/booking/unpaid-cancel';
import { runAutoCall } from '@/lib/booking/auto-call-runner';
import { safeCreateNotification } from '@/lib/notifications/createNotification';
import { getSiteSettings, logBooking } from '@/lib/booking/server';
import { addDaysIso, toBangkokStamp } from '@/lib/booking/slot-time';
import { safeNotifyDriver, safeNotifyPartner, safeNotifyStaffGroup } from '@/lib/line/notify';
import { safeNotifyDriverPush } from '@/lib/push/send';

export const dynamic = 'force-dynamic';

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // unset = endpoint closed
  const got = Buffer.from(req.headers.get('authorization') ?? '');
  const want = Buffer.from(`Bearer ${secret}`);
  return got.length === want.length && timingSafeEqual(got, want);
}

/**
 * Minute tick (Supabase pg_cron → here):
 *  1. overdue sweep — confirmed→late, late→no_show, called→no_show
 *  2. auto-call — fill free docks with checked-in vehicles (also a backstop for a missed event)
 *  3. wait notice — checked-in trucks past their appointment that still could not be called
 *     get one "ท่ายังไม่ว่าง กรุณารอสักครู่" (LINE + Web Push), stamped in `wait_notified_at`
 *  4. unpaid sweep — customer-link queues on an unpaid SO get one warning before their payment
 *     deadline (`payment_warned_at`) and are cancelled through `cancel_unpaid_booking` once it passes
 * Every write is conditional on the status that was read, so overlapping ticks are harmless.
 */
const UNPAID_CANCEL_REASON = 'ไม่ได้ชำระเงินภายในเวลาที่กำหนด — ระบบยกเลิกอัตโนมัติ';
/** Each cancel is up to three LINE pushes; keep one tick inside the free plan's monthly quota. */
const UNPAID_SWEEP_LIMIT = 50;

type UnpaidRow = UnpaidCandidate & {
  queue_number: string; branch_id: string | null;
  external_documents: { doc_no: string; partner_name: string | null; payment_updated_at: string | null } | null;
};
export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const admin = createAdminClient();
    const shopKey = process.env.SITE_SHOP_KEY || 'fameline';
    const { data: shop } = await admin.from('shops').select('id,company_id').eq('shop_key', shopKey).eq('is_deleted', false).maybeSingle();
    if (!shop) return NextResponse.json({ error: `site "${shopKey}" not found` }, { status: 500 });
    const site = { shopId: shop.id as string, companyId: shop.company_id as string };

    const now = new Date();
    const settings = await getSiteSettings(admin, site.shopId);
    const today = toBangkokStamp(now).date;

    // Yesterday is included so a late-evening appointment still gets closed after midnight.
    const { data: rows, error } = await admin
      .from('bookings')
      .select('id,queue_number,status,grace_deadline,called_timeout_at,resource_id,booking_date,start_time,customers(full_name)')
      .eq('shop_id', site.shopId)
      .eq('is_deleted', false)
      .gte('booking_date', addDaysIso(today, -1))
      .lte('booking_date', today)
      .in('status', ['confirmed', 'late', 'called']);
    if (error) throw error;

    const moves = computeOverdueMoves(
      (rows ?? []).map((r) => ({ id: r.id as string, status: String(r.status), grace_deadline: r.grace_deadline as string | null, called_timeout_at: r.called_timeout_at as string | null })),
      now,
      settings,
    );
    let swept = 0;
    for (const m of moves) {
      const { data: updated } = await admin.from('bookings').update({ status: m.to }).eq('id', m.id).eq('shop_id', site.shopId).eq('status', m.from).select('id');
      if (!updated || updated.length === 0) continue;
      swept += 1;
      const row = rows?.find((r) => r.id === m.id);
      await logBooking(admin, {
        companyId: site.companyId, shopId: site.shopId, bookingId: m.id, action: 'status_change',
        description: `${row?.queue_number ?? m.id}: ${m.from} → ${m.to} (${m.reason})`, from: { status: m.from }, to: { status: m.to, reason: m.reason }, actorKind: 'system',
      });
      const partner = ((row as unknown as { customers?: { full_name?: string | null } | null } | undefined)?.customers?.full_name) ?? '-';
      const queueNo = String(row?.queue_number ?? m.id);
      if (m.to === 'no_show') {
        await safeNotifyPartner(admin, { shopId: site.shopId, bookingId: m.id, kind: 'no_show' });
        await safeNotifyStaffGroup(admin, { shopId: site.shopId, bookingId: m.id, event: { kind: 'no_show', queueNo, partner, date: String(row?.booking_date ?? today), time: String(row?.start_time ?? '') } });
      } else if (m.to === 'late') {
        // The truck is overdue: tell the driver (LINE + browser push) and the customer / supplier, then the team.
        await safeNotifyDriver(admin, { shopId: site.shopId, bookingId: m.id, kind: 'late' });
        await safeNotifyDriverPush(admin, { shopId: site.shopId, bookingId: m.id, kind: 'late' });
        await safeNotifyPartner(admin, { shopId: site.shopId, bookingId: m.id, kind: 'late' });
        await safeNotifyStaffGroup(admin, { shopId: site.shopId, bookingId: m.id, event: { kind: 'late', queueNo, partner, time: String(row?.start_time ?? '') } });
      }
    }

    const { called } = await runAutoCall(admin, site, { settings, now });

    // After auto-call, whoever is still waiting past their appointment gets the "please wait" notice.
    const waited: string[] = [];
    if (settings.wait_notice_enabled) {
      const { data: waiting } = await admin
        .from('bookings')
        .select('id,queue_number,booking_date,start_time,wait_notified_at')
        .eq('shop_id', site.shopId)
        .eq('is_deleted', false)
        .eq('booking_date', today)
        .eq('status', 'checked_in')
        .is('wait_notified_at', null);
      const ids = computeWaitNotices(
        (waiting ?? []).map((r) => ({ id: r.id as string, status: 'checked_in', booking_date: String(r.booking_date), start_time: String(r.start_time), wait_notified_at: null })),
        now,
        settings,
      );
      for (const id of ids) {
        const { data: stamped } = await admin.from('bookings').update({ wait_notified_at: now.toISOString() }).eq('id', id).eq('shop_id', site.shopId).eq('status', 'checked_in').is('wait_notified_at', null).select('id,queue_number');
        if (!stamped || stamped.length === 0) continue;
        const queueNo = String(stamped[0].queue_number ?? id);
        waited.push(queueNo);
        await logBooking(admin, { companyId: site.companyId, shopId: site.shopId, bookingId: id, action: 'wait_notice', description: `${queueNo}: เลยเวลานัดแล้วท่ายังไม่ว่าง — แจ้งคนขับให้รอ`, to: { wait_notified_at: now.toISOString() }, actorKind: 'system' });
        await safeNotifyDriver(admin, { shopId: site.shopId, bookingId: id, kind: 'waiting' });
        await safeNotifyDriverPush(admin, { shopId: site.shopId, bookingId: id, kind: 'waiting' });
      }
    }

    // Unpaid customer queues: warn once, then cancel. The RPC re-checks the SO under lock, so a
    // payment recorded between this read and the cancel keeps the queue.
    const unpaidWarned: string[] = [];
    const unpaidCancelled: string[] = [];
    if (settings.unpaid_cancel_enabled) {
      const { data: unpaid, error: unpaidError } = await admin
        .from('bookings')
        .select('id,queue_number,status,booking_source,created_at,booking_date,start_time,payment_warned_at,branch_id,external_documents!inner(doc_no,partner_name,doc_type,payment_status,payment_updated_at)')
        .eq('shop_id', site.shopId)
        .eq('is_deleted', false)
        .eq('status', 'pending')
        .eq('booking_source', 'customer_link')
        .eq('external_documents.doc_type', 'so')
        .eq('external_documents.payment_status', 'unpaid')
        .order('created_at', { ascending: true })
        .limit(UNPAID_SWEEP_LIMIT);
      if (unpaidError) throw unpaidError;
      const rows = ((unpaid ?? []) as unknown as UnpaidRow[]).map((r) => ({ ...r, payment_updated_at: r.external_documents?.payment_updated_at ?? null }));
      const actions = computeUnpaidActions(rows, now, settings);

      for (const id of actions.warn) {
        const row = rows.find((r) => r.id === id);
        if (!row) continue;
        const { data: stamped } = await admin.from('bookings').update({ payment_warned_at: now.toISOString() }).eq('id', id).eq('shop_id', site.shopId).eq('status', 'pending').is('payment_warned_at', null).select('id');
        if (!stamped || stamped.length === 0) continue;
        const dueAt = paymentDeadline(row, settings)?.toISOString() ?? null;
        unpaidWarned.push(row.queue_number);
        await logBooking(admin, {
          companyId: site.companyId, shopId: site.shopId, bookingId: id, action: 'payment_warning',
          description: `${row.queue_number}: แจ้งลูกค้าว่าคิวจะถูกยกเลิกอัตโนมัติถ้ายังไม่ชำระเงิน`, to: { payment_warned_at: now.toISOString(), due_at: dueAt }, actorKind: 'system',
        });
        await safeNotifyPartner(admin, { shopId: site.shopId, bookingId: id, kind: 'payment_warning', dueAt });
      }

      for (const id of actions.cancel) {
        const row = rows.find((r) => r.id === id);
        if (!row) continue;
        const { data: done, error: cancelError } = await admin.rpc('cancel_unpaid_booking', { p_shop_id: site.shopId, p_booking_id: id, p_reason: UNPAID_CANCEL_REASON });
        if (cancelError) { console.error('[cron/auto-call] cancel_unpaid_booking failed:', cancelError.message); continue; }
        if (done !== true) continue;
        unpaidCancelled.push(row.queue_number);
        const doc = row.external_documents;
        await logBooking(admin, {
          companyId: site.companyId, shopId: site.shopId, bookingId: id, action: 'status_change',
          description: `${row.queue_number}: pending → cancelled (unpaid_timeout)`, from: { status: 'pending' }, to: { status: 'cancelled', reason: 'unpaid_timeout' }, actorKind: 'system',
        });
        await safeCreateNotification(admin, {
          companyId: site.companyId, shopId: site.shopId, branchId: row.branch_id,
          type: 'booking_cancelled', category: 'bookings', priority: 'high',
          title: `ยกเลิกคิว ${row.queue_number} อัตโนมัติ — ไม่ชำระเงิน`,
          message: `${doc?.partner_name ?? '-'} · ${doc?.doc_no ?? '-'} · ${row.booking_date} ${String(row.start_time).slice(0, 5)}`,
          relatedType: 'booking', relatedId: id, actionUrl: '/portal/bookings', icon: 'Cancel', color: '#c62828',
        });
        await safeNotifyPartner(admin, { shopId: site.shopId, bookingId: id, kind: 'cancelled', by: 'system' });
        await safeNotifyStaffGroup(admin, {
          shopId: site.shopId, bookingId: id,
          event: { kind: 'unpaid_cancelled', queueNo: row.queue_number, partner: doc?.partner_name ?? '-', docNo: doc?.doc_no ?? null, date: String(row.booking_date), time: String(row.start_time) },
        });
      }
    }

    await admin.from('site_settings').update({ auto_call_last_run_at: now.toISOString() }).eq('shop_id', site.shopId);

    return NextResponse.json({ data: { swept, called: called.map((c) => c.queueNumber), waited, unpaid_warned: unpaidWarned, unpaid_cancelled: unpaidCancelled } });
  } catch (e) {
    console.error('[cron/auto-call]', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'cron failed' }, { status: 500 });
  }
}
