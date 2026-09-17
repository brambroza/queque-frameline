import { NextResponse } from 'next/server';
import { requireAuthContext, getErrorStatus } from '@/lib/auth/context';
import { directionSchema, isoDateSchema } from '@/lib/booking/schemas';
import { addDaysIso, toBangkokStamp } from '@/lib/booking/slot-time';
import { resolveDefaultBranchId } from '@/lib/booking/server';

/** Days that still have an open slot — drives the portal calendar's enabled dates. */
export async function GET(req: Request) {
  try {
    const { supabase, profile } = await requireAuthContext({ roles: ['admin', 'staff'] });
    const sp = new URL(req.url).searchParams;
    const direction = directionSchema.safeParse(sp.get('direction'));
    const serviceId = sp.get('service_id');
    if (!direction.success || !serviceId) return NextResponse.json({ error: 'Missing direction or service_id' }, { status: 400 });

    const now = new Date();
    const today = toBangkokStamp(now).date;
    const from = isoDateSchema.safeParse(sp.get('from'));
    const to = isoDateSchema.safeParse(sp.get('to'));
    const fromDate = from.success && from.data > today ? from.data : today;
    const toDate = to.success ? to.data : addDaysIso(fromDate, 41);
    const branchId = sp.get('branch_id') || (await resolveDefaultBranchId(supabase, profile.shop_id));

    const { data, error } = await supabase.rpc('get_available_days', {
      p_shop_id: profile.shop_id,
      p_branch_id: branchId,
      p_direction: direction.data,
      p_service_id: serviceId,
      p_from: fromDate,
      p_to: toDate,
      p_not_before: now.toISOString(),
    });
    if (error) throw error;
    return NextResponse.json({ data: data ?? [], meta: { from: fromDate, to: toDate, today } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}
