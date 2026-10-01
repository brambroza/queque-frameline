import { NextResponse } from 'next/server';
import { requireAuthContext, getErrorStatus } from '@/lib/auth/context';
import { assertBranchWritable } from '@/lib/auth/branch-scope';
import { directionSchema, isoDateSchema } from '@/lib/booking/schemas';
import { dockErrorResponse, resolveDefaultBranchId } from '@/lib/booking/server';
import {
  decorateSlots, decorateWalkInSlots, pickLastQueue, toBangkokStamp, type LastQueue, type LiveQueueRow, type SlotRow,
} from '@/lib/booking/slot-time';
import { LIVE_STATUSES } from '@/lib/booking/status-flow';

/**
 * Slots of one day for a vehicle type + direction (portal create / reschedule).
 * Staff are not bound by the customer lead time, only by the clock.
 *
 * `walk_in=1` = the truck is on site: the day is always today (server clock,
 * `date` is ignored), the slot running right now may be taken, and when
 * working hours are used up the grid continues after the last queue (rows
 * flagged `overflow`). `meta` then also carries the server time and the last
 * queue the truck would wait behind, so the picker can say "last queue ends
 * at …" without a second round trip.
 */
export async function GET(req: Request) {
  try {
    const { supabase, profile, branchScope } = await requireAuthContext({ roles: ['admin', 'staff'] });
    const sp = new URL(req.url).searchParams;
    const walkIn = sp.get('walk_in') === '1';
    const now = new Date();
    const stamp = toBangkokStamp(now);
    const direction = directionSchema.safeParse(sp.get('direction'));
    const date = isoDateSchema.safeParse(walkIn ? stamp.date : sp.get('date'));
    const serviceId = sp.get('service_id');
    if (!direction.success || !date.success || !serviceId) {
      return NextResponse.json({ error: 'Missing direction, service_id or date' }, { status: 400 });
    }
    const branchId = sp.get('branch_id') || (await resolveDefaultBranchId(supabase, profile.shop_id, branchScope));
    // Requested or default branch must be in scope; a limited caller never queries without a branch.
    assertBranchWritable(branchScope, branchId);
    const resourceId = sp.get('resource_id') || null;

    const { data, error } = await supabase.rpc('get_dock_slots', {
      p_shop_id: profile.shop_id,
      p_branch_id: branchId,
      p_direction: direction.data,
      p_service_id: serviceId,
      p_date: date.data,
      p_resource_id: resourceId,
      p_exclude_booking_id: sp.get('exclude_booking_id') || null,
      // Only a walk-in asks for overflow, so the regular grid keeps working before the migration runs.
      ...(walkIn ? { p_overflow: true } : {}),
    });
    if (error) {
      const mapped = walkIn ? dockErrorResponse(error.message) : null;
      if (mapped) return NextResponse.json({ error: mapped.error, code: mapped.code }, { status: mapped.status });
      throw error;
    }
    const rows = (data ?? []) as SlotRow[];

    if (!walkIn) {
      return NextResponse.json({ data: decorateSlots(date.data, rows, now, 0), meta: { date: date.data } });
    }

    // The queue the truck would wait behind: the live booking blocking an eligible dock the longest today.
    let lastQueue: LastQueue | null = null;
    const [{ data: dockRows }, { data: liveRows }] = await Promise.all([
      supabase.rpc('eligible_docks', {
        p_shop_id: profile.shop_id, p_branch_id: branchId, p_direction: direction.data, p_service_id: serviceId, p_resource_id: resourceId,
      }),
      supabase
        .from('bookings')
        .select('queue_number,start_time,end_time,buffer_minutes,resource_id,resource_name,direction')
        .eq('shop_id', profile.shop_id)
        .eq('booking_date', date.data)
        .eq('is_deleted', false)
        .in('status', LIVE_STATUSES as readonly string[]),
    ]);
    const dockIds = ((dockRows ?? []) as Array<{ dock_id: string }>).map((d) => d.dock_id);
    lastQueue = pickLastQueue((liveRows ?? []) as LiveQueueRow[], dockIds, direction.data);

    return NextResponse.json({
      data: decorateWalkInSlots(date.data, rows, now),
      meta: { date: date.data, now: stamp.time.slice(0, 5), last_queue: lastQueue },
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}
