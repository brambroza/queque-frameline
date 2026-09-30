/**
 * Walk-in queues: the truck is already on site when the queue is made, so a
 * confirmed walk-in is checked in straight away instead of waiting for the
 * gate. Shared by `POST /api/bookings` (paid / credit / no payment gate) and
 * `PATCH /api/bookings` (an unpaid walk-in approved later the same day).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { runAutoCall } from '@/lib/booking/auto-call-runner';
import { logBooking, type SiteSettings } from '@/lib/booking/server';
import { CHECKIN_STATUSES, transitionStamps, type TransitionActor } from '@/lib/booking/status-flow';
import { safeNotifyStaffGroup } from '@/lib/line/notify';

export type WalkInArrivalInput = {
  shopId: string;
  companyId: string;
  bookingId: string;
  actorId: string;
  settings: SiteSettings;
  now?: Date;
};

export type WalkInCheckIn = { checkedIn: boolean; dockId: string | null; dockName: string | null };

/**
 * Move a just-confirmed walk-in to `checked_in`. Meant to run as the very next
 * statement after the confirm, so the cron sweep has no room to mark it late;
 * `late` is accepted anyway in case a tick did land in between.
 *
 * Never throws: the queue and its DO already exist, so a failed check-in is
 * reported to the caller, who tells staff to press "รถมาถึงแล้ว".
 *
 * @param admin Service-role client. The caller has already checked role, shop and branch.
 */
export async function checkInWalkIn(admin: SupabaseClient, input: WalkInArrivalInput): Promise<WalkInCheckIn> {
  try {
    const stamps = transitionStamps('confirmed', 'checked_in', {
      now: input.now ?? new Date(),
      actorId: input.actorId,
      callCount: 0,
      calledTimeoutMinutes: input.settings.called_timeout_minutes,
    });
    const { data, error } = await admin
      .from('bookings')
      .update({ status: 'checked_in', updated_by: input.actorId, ...stamps })
      .eq('id', input.bookingId)
      .eq('shop_id', input.shopId)
      .in('status', [...CHECKIN_STATUSES])
      .select('id,resource_id,resource_name');
    if (error) throw error;
    const row = data?.[0];
    if (!row) return { checkedIn: false, dockId: null, dockName: null };
    return { checkedIn: true, dockId: (row.resource_id as string | null) ?? null, dockName: (row.resource_name as string | null) ?? null };
  } catch (e) {
    console.error('[walk-in] check-in failed:', e instanceof Error ? e.message : e);
    return { checkedIn: false, dockId: null, dockName: null };
  }
}

/**
 * Side effects of a walk-in check-in, run after the caller wrote its own log
 * line so the timeline reads in order: audit log, the warehouse LINE group and
 * an auto-call attempt (the dock may be free right now).
 *
 * @returns Queue numbers the auto-call sent to a dock — not necessarily this one.
 */
export async function announceWalkInArrival(
  admin: SupabaseClient,
  input: WalkInArrivalInput & { queueNumber: string; plate: string; dockId: string | null; dockName: string | null; actorKind: Extract<TransitionActor, 'admin' | 'staff'> },
): Promise<string[]> {
  await logBooking(admin, {
    companyId: input.companyId,
    shopId: input.shopId,
    bookingId: input.bookingId,
    action: 'status_change',
    description: `${input.queueNumber}: confirmed → checked_in (Walk-in)`,
    from: { status: 'confirmed' },
    to: { status: 'checked_in', walk_in: true },
    actorKind: input.actorKind,
    actorId: input.actorId,
  });
  await safeNotifyStaffGroup(admin, {
    shopId: input.shopId,
    bookingId: input.bookingId,
    event: { kind: 'arrived', queueNo: input.queueNumber, plate: input.plate || '-', dock: input.dockName, by: 'staff' },
  });
  if (!input.dockId) return [];
  try {
    const result = await runAutoCall(admin, { shopId: input.shopId, companyId: input.companyId }, { dockId: input.dockId, settings: input.settings, now: input.now });
    return result.called.map((c) => c.queueNumber);
  } catch (e) {
    console.error('[walk-in] auto-call failed:', e instanceof Error ? e.message : e);
    return [];
  }
}
