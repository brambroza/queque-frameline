import { NextResponse } from 'next/server';
import { requireAuthContext, getErrorStatus } from '@/lib/auth/context';
import { assertBranchWritable } from '@/lib/auth/branch-scope';
import { directionSchema, isoDateSchema } from '@/lib/booking/schemas';
import { decorateSlots, decorateWalkInSlots, toBangkokStamp, type SlotRow } from '@/lib/booking/slot-time';
import { resolveDefaultBranchId } from '@/lib/booking/server';

/**
 * Slots of one day for a vehicle type + direction (portal create / reschedule).
 * Staff are not bound by the customer lead time, only by the clock.
 *
 * `walk_in=1` = the truck is on site: the day is always today (server clock,
 * `date` is ignored) and the slot running right now may be taken too. The day
 * used comes back in `meta.date`.
 */
export async function GET(req: Request) {
  try {
    const { supabase, profile, branchScope } = await requireAuthContext({ roles: ['admin', 'staff'] });
    const sp = new URL(req.url).searchParams;
    const walkIn = sp.get('walk_in') === '1';
    const now = new Date();
    const direction = directionSchema.safeParse(sp.get('direction'));
    const date = isoDateSchema.safeParse(walkIn ? toBangkokStamp(now).date : sp.get('date'));
    const serviceId = sp.get('service_id');
    if (!direction.success || !date.success || !serviceId) {
      return NextResponse.json({ error: 'Missing direction, service_id or date' }, { status: 400 });
    }
    const branchId = sp.get('branch_id') || (await resolveDefaultBranchId(supabase, profile.shop_id, branchScope));
    // Requested or default branch must be in scope; a limited caller never queries without a branch.
    assertBranchWritable(branchScope, branchId);

    const { data, error } = await supabase.rpc('get_dock_slots', {
      p_shop_id: profile.shop_id,
      p_branch_id: branchId,
      p_direction: direction.data,
      p_service_id: serviceId,
      p_date: date.data,
      p_resource_id: sp.get('resource_id') || null,
      p_exclude_booking_id: sp.get('exclude_booking_id') || null,
    });
    if (error) throw error;
    const rows = (data ?? []) as SlotRow[];
    return NextResponse.json({
      data: walkIn ? decorateWalkInSlots(date.data, rows, now) : decorateSlots(date.data, rows, now, 0),
      meta: { date: date.data },
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}
