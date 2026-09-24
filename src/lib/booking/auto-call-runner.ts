/**
 * Applies auto-call picks. Used by the event path (a dock was just released)
 * and by the cron sweep. Idempotent: every write is conditional on the row
 * still being `checked_in`, so a simultaneous staff click simply wins.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { BookingDirection } from '@/types/db';
import { pickNextToCall, type CallCandidate, type DockState } from '@/lib/booking/auto-call';
import { transitionStamps } from '@/lib/booking/status-flow';
import { getSiteSettings, logBooking, type SiteSettings } from '@/lib/booking/server';
import { safeCreateNotification } from '@/lib/notifications/createNotification';
import { getTodayISOInBangkok } from '@/lib/utils/date-format';
import { safeNotifyDriver, safeNotifyPartner, safeNotifyStaffGroup } from '@/lib/line/notify';
import { safeNotifyDriverPush } from '@/lib/push/send';
import { effectivePlate } from '@/lib/booking/plate';

export type AutoCallResult = { called: Array<{ bookingId: string; dockId: string; queueNumber: string }> };

/**
 * @param admin Service-role client (the system acts, not a user).
 * @param shop Site ids.
 * @param opts.dockId Restrict to one released dock (event path).
 * @param opts.settings Pass when already loaded.
 */
export async function runAutoCall(
  admin: SupabaseClient,
  shop: { shopId: string; companyId: string },
  opts: { dockId?: string | null; settings?: SiteSettings; now?: Date } = {},
): Promise<AutoCallResult> {
  const settings = opts.settings ?? (await getSiteSettings(admin, shop.shopId));
  if (settings.auto_call_mode === 'off') return { called: [] };
  const now = opts.now ?? new Date();
  const today = getTodayISOInBangkok();

  const [{ data: dockRows }, { data: liveRows }] = await Promise.all([
    admin
      .from('booking_resources')
      .select('id,resource_name,direction,service_ids')
      .eq('shop_id', shop.shopId)
      .eq('resource_type', 'dock')
      .eq('active', true)
      .eq('is_deleted', false),
    admin
      .from('bookings')
      .select('id,queue_number,status,resource_id,resource_name,service_id,direction,booking_date,start_time,checked_in_at,call_count,branch_id,plate_number,plate_number_actual')
      .eq('shop_id', shop.shopId)
      .eq('booking_date', today)
      .eq('is_deleted', false)
      .in('status', ['checked_in', 'called', 'serving']),
  ]);

  const live = liveRows ?? [];
  const busy = new Set(live.filter((b) => b.status !== 'checked_in' && b.resource_id).map((b) => b.resource_id as string));
  const docks: Array<DockState & { name: string | null }> = (dockRows ?? []).map((d) => ({
    id: d.id as string,
    name: (d.resource_name as string | null) ?? null,
    direction: (d.direction as BookingDirection | null) ?? null,
    service_ids: (d.service_ids as string[] | null) ?? null,
    busy: busy.has(d.id as string),
  }));
  const candidates: CallCandidate[] = live
    .filter((b) => b.status === 'checked_in')
    .map((b) => ({
      id: b.id as string,
      resource_id: (b.resource_id as string | null) ?? null,
      service_id: b.service_id as string,
      direction: b.direction as BookingDirection,
      booking_date: String(b.booking_date),
      start_time: String(b.start_time),
      checked_in_at: (b.checked_in_at as string | null) ?? null,
    }));

  const picks = pickNextToCall(docks, candidates, now, settings, opts.dockId ?? null);
  const called: AutoCallResult['called'] = [];

  for (const pick of picks) {
    const row = live.find((b) => b.id === pick.bookingId);
    if (!row) continue;
    const stamps = transitionStamps('checked_in', 'called', {
      now,
      actorId: null,
      callCount: Number(row.call_count ?? 0),
      calledTimeoutMinutes: settings.called_timeout_minutes,
      auto: true,
    });
    const update: Record<string, unknown> = { status: 'called', ...stamps };
    const dock = docks.find((d) => d.id === pick.dockId);
    if (pick.assignDock) { update.resource_id = pick.dockId; update.resource_name = dock?.name ?? null; }

    const { data: updated } = await admin
      .from('bookings')
      .update(update)
      .eq('id', pick.bookingId)
      .eq('shop_id', shop.shopId)
      .eq('status', 'checked_in')
      .select('id');
    if (!updated || updated.length === 0) continue; // someone else moved it first

    const queueNumber = String(row.queue_number ?? '');
    called.push({ bookingId: pick.bookingId, dockId: pick.dockId, queueNumber });
    await logBooking(admin, {
      companyId: shop.companyId,
      shopId: shop.shopId,
      bookingId: pick.bookingId,
      action: 'status_change',
      description: `Auto-called ${queueNumber}`,
      from: { status: 'checked_in' },
      to: { status: 'called', dock_id: pick.dockId, auto: true },
      actorKind: 'system',
    });
    await safeCreateNotification(admin, {
      companyId: shop.companyId,
      shopId: shop.shopId,
      branchId: (row.branch_id as string | null) ?? null,
      type: 'queue_auto_called',
      category: 'bookings',
      priority: 'medium',
      title: `เรียกคิว ${queueNumber} อัตโนมัติ`,
      message: `ระบบเรียกคิว ${queueNumber} เข้าท่าอัตโนมัติ`,
      relatedType: 'booking',
      relatedId: pick.bookingId,
      actionUrl: '/portal/queue-board',
      icon: 'Campaign',
      color: '#1565c0',
      metadata: { auto: true, dock_id: pick.dockId },
    });
    // Driver: LINE when bound, browser push when subscribed — both may fire; the page dedupes by tag.
    await safeNotifyDriver(admin, { shopId: shop.shopId, bookingId: pick.bookingId, kind: 'called' });
    await safeNotifyDriverPush(admin, { shopId: shop.shopId, bookingId: pick.bookingId, kind: 'called' });
    await safeNotifyPartner(admin, { shopId: shop.shopId, bookingId: pick.bookingId, kind: 'called' });
    await safeNotifyStaffGroup(admin, { shopId: shop.shopId, bookingId: pick.bookingId, event: { kind: 'auto_called', queueNo: queueNumber, plate: effectivePlate(row) || '-', dock: dock?.name ?? (row.resource_name as string | null) ?? null } });
  }
  return { called };
}
