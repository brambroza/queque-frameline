import { NextResponse } from 'next/server';
import { requireAuthContext, getErrorStatus } from '@/lib/auth/context';
import { assertBranchWritable } from '@/lib/auth/branch-scope';
import { directionSchema, isoDateSchema } from '@/lib/booking/schemas';
import { decorateSlots, type SlotRow } from '@/lib/booking/slot-time';
import { resolveDefaultBranchId } from '@/lib/booking/server';

/**
 * Slots of one day for a vehicle type + direction (portal create / reschedule).
 * Staff are not bound by the customer lead time, only by the clock.
 */
export async function GET(req: Request) {
  try {
    const { supabase, profile, branchScope } = await requireAuthContext({ roles: ['admin', 'staff'] });
    const sp = new URL(req.url).searchParams;
    const direction = directionSchema.safeParse(sp.get('direction'));
    const date = isoDateSchema.safeParse(sp.get('date'));
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
    return NextResponse.json({ data: decorateSlots(date.data, (data ?? []) as SlotRow[], new Date(), 0) });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}
