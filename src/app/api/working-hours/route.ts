import { NextResponse } from 'next/server';
import { requireAuthContext, getErrorStatus } from '@/lib/auth/context';
import { applyBranchScope, assertBranchAllowed } from '@/lib/auth/branch-scope';
import { workingHourSchema } from '@/lib/booking/schemas';
import { writeAuditLog } from '@/lib/audit/activity-log';

export async function GET(req: Request) {
  try {
    const { supabase, profile, branchScope } = await requireAuthContext({ roles: ['super_admin', 'shop_owner', 'branch_manager', 'staff'] });
    const { searchParams } = new URL(req.url);
    const branchId = searchParams.get('branch_id');
    const weekday = searchParams.get('weekday');

    let query = supabase
      .from('working_hours')
      .select('*, branches(branch_name)')
      .eq('shop_id', profile.shop_id)
      .eq('is_deleted', false)
      .order('weekday');

    query = applyBranchScope(query, branchScope, branchId);
    if (weekday) query = query.eq('weekday', Number(weekday));

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ data });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}

export async function POST(req: Request) {
  try {
    const { supabase, user, profile, branchScope } = await requireAuthContext({ roles: ['super_admin', 'shop_owner', 'branch_manager'] });
    const parsed = workingHourSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    assertBranchAllowed(branchScope, parsed.data.branch_id);

    const { error } = await supabase.from('working_hours').insert({
      ...parsed.data,
      company_id: profile.company_id,
      shop_id: profile.shop_id,
      created_by: user.id,
      updated_by: user.id,
    });

    if (error) throw error;
    return NextResponse.json({ data: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}

export async function DELETE(req: Request) {
  try {
    const { supabase, user, profile } = await requireAuthContext({ roles: ['super_admin', 'shop_owner'] });
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const { error } = await supabase
      .from('working_hours')
      .update({ is_deleted: true, active: false, updated_by: user.id })
      .eq('id', id)
      .eq('shop_id', profile.shop_id);

    if (error) throw error;
    await writeAuditLog({
      companyId: profile.company_id,
      shopId: profile.shop_id,
      userId: user.id,
      action: 'data_deleted',
      targetTable: 'working_hours',
      targetId: id,
      payload: { soft_delete: true },
    });
    return NextResponse.json({ data: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}

export async function PATCH(req: Request) {
  try {
    const { supabase, user, profile, branchScope } = await requireAuthContext({ roles: ['super_admin', 'shop_owner', 'branch_manager'] });
    const body = await req.json();
    const id = String(body?.id ?? '');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const parsed = workingHourSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    // Both the row being edited and the branch it is being moved to must be in scope.
    assertBranchAllowed(branchScope, parsed.data.branch_id);
    const { data: current } = await supabase
      .from('working_hours')
      .select('branch_id')
      .eq('id', id)
      .eq('shop_id', profile.shop_id)
      .maybeSingle();
    if (!current) return NextResponse.json({ error: 'Working hour not found' }, { status: 404 });
    assertBranchAllowed(branchScope, current.branch_id);

    const { error } = await supabase
      .from('working_hours')
      .update({ ...parsed.data, updated_by: user.id })
      .eq('id', id)
      .eq('shop_id', profile.shop_id)
      .eq('is_deleted', false);

    if (error) throw error;
    return NextResponse.json({ data: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}
