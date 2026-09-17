import { NextResponse } from 'next/server';
import { requireAuthContext, getErrorStatus } from '@/lib/auth/context';
import { applyBranchScope } from '@/lib/auth/branch-scope';

export async function GET(req: Request) {
  try {
    const { supabase, profile, branchScope } = await requireAuthContext({ roles: ['admin', 'staff'] });
    const { searchParams } = new URL(req.url);
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const status = searchParams.get('status');
    const branchId = searchParams.get('branch_id');
    const serviceId = searchParams.get('service_id');

    let query = supabase
      .from('bookings')
      .select('id,booking_date,start_time,end_time,status,queue_number,resource_id,resource_name,branches(branch_name),services(service_name),customers(full_name,nickname)')
      .eq('shop_id', profile.shop_id)
      .eq('is_deleted', false)
      .order('booking_date', { ascending: true })
      .order('start_time', { ascending: true });

    if (from) query = query.gte('booking_date', from);
    if (to) query = query.lte('booking_date', to);
    if (status) query = query.eq('status', status);
    query = applyBranchScope(query, branchScope, branchId);
    if (serviceId) query = query.eq('service_id', serviceId);

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ data: data ?? [] });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}
