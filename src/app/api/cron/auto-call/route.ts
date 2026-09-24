import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { computeOverdueMoves } from '@/lib/booking/overdue';
import { runAutoCall } from '@/lib/booking/auto-call-runner';
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
 * Every write is conditional on the status that was read, so overlapping ticks are harmless.
 */
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
    await admin.from('site_settings').update({ auto_call_last_run_at: now.toISOString() }).eq('shop_id', site.shopId);

    return NextResponse.json({ data: { swept, called: called.map((c) => c.queueNumber) } });
  } catch (e) {
    console.error('[cron/auto-call]', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'cron failed' }, { status: 500 });
  }
}
