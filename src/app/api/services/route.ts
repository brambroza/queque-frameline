import { NextResponse } from 'next/server';
import { requireAuthContext, getErrorStatus } from '@/lib/auth/context';
import { serviceSchema } from '@/lib/booking/schemas';
import { assertFeatureQuota } from '@/lib/subscription/enforcement';
import { subscriptionErrorResponse } from '@/lib/subscription/response';
import { writeAuditLog } from '@/lib/audit/activity-log';

function toInt(v: string | null, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

export async function GET(req: Request) {
  try {
    const { supabase, profile } = await requireAuthContext({ roles: ['super_admin', 'shop_owner', 'branch_manager', 'staff'] });
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q');
    const active = searchParams.get('active');
    const page = toInt(searchParams.get('page'), 1);
    const pageSize = Math.min(toInt(searchParams.get('page_size'), 20), 100);

    let query = supabase
      .from('services')
      .select('*, service_categories(category_name)', { count: 'exact' })
      .eq('shop_id', profile.shop_id)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false });

    if (q) query = query.ilike('service_name', `%${q}%`);
    if (active === 'true' || active === 'false') query = query.eq('active', active === 'true');

    const from = (page - 1) * pageSize;
    const { data, error, count } = await query.range(from, from + pageSize - 1);
    if (error) throw error;
    return NextResponse.json({ data, pagination: { page, page_size: pageSize, total: count ?? 0 } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}

export async function POST(req: Request) {
  try {
    const { supabase, user, profile } = await requireAuthContext({ roles: ['super_admin', 'shop_owner', 'branch_manager'] });
    const parsed = serviceSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

    const { count: serviceCount } = await supabase
      .from('services')
      .select('id', { count: 'exact', head: true })
      .eq('shop_id', profile.shop_id)
      .eq('is_deleted', false);
    await assertFeatureQuota(profile.shop_id, 'services', serviceCount ?? 0);

    const { data: category } = await supabase.from('service_categories').select('id').eq('shop_id', profile.shop_id).limit(1).maybeSingle();

    const { error } = await supabase.from('services').insert({
      company_id: profile.company_id,
      shop_id: profile.shop_id,
      service_name: parsed.data.service_name,
      category_id: category?.id ?? null,
      booking_mode: parsed.data.booking_mode,
      duration_minutes: parsed.data.duration_minutes ?? 30,
      min_duration_minutes: parsed.data.min_duration_minutes ?? null,
      max_duration_minutes: parsed.data.max_duration_minutes ?? null,
      capacity_per_slot: parsed.data.capacity_per_slot,
      requires_approval: parsed.data.requires_approval,
      allow_walk_in: parsed.data.allow_walk_in,
      price: parsed.data.price,
      active: parsed.data.active,
      created_by: user.id,
      updated_by: user.id,
    });

    if (error) throw error;
    return NextResponse.json({ data: true });
  } catch (e) {
    const quota = subscriptionErrorResponse(e);
    if (quota) return quota;
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}

export async function PATCH(req: Request) {
  try {
    const { supabase, user, profile } = await requireAuthContext({ roles: ['super_admin', 'shop_owner', 'branch_manager'] });
    const body = await req.json();
    const id = body.id as string;
    const parsed = serviceSchema.safeParse(body);
    if (!id || !parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

    const { error } = await supabase
      .from('services')
      .update({
        service_name: parsed.data.service_name,
        booking_mode: parsed.data.booking_mode,
        duration_minutes: parsed.data.duration_minutes ?? 30,
        min_duration_minutes: parsed.data.min_duration_minutes ?? null,
        max_duration_minutes: parsed.data.max_duration_minutes ?? null,
        capacity_per_slot: parsed.data.capacity_per_slot,
        requires_approval: parsed.data.requires_approval,
        allow_walk_in: parsed.data.allow_walk_in,
        price: parsed.data.price,
        active: parsed.data.active,
        updated_by: user.id,
      })
      .eq('id', id)
      .eq('shop_id', profile.shop_id);

    if (error) throw error;
    await writeAuditLog({
      companyId: profile.company_id,
      shopId: profile.shop_id,
      userId: user.id,
      action: 'data_deleted',
      targetTable: 'services',
      targetId: id,
      payload: { soft_delete: true },
    });
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
      .from('services')
      .update({ is_deleted: true, active: false, updated_by: user.id })
      .eq('id', id)
      .eq('shop_id', profile.shop_id);

    if (error) throw error;
    return NextResponse.json({ data: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}
