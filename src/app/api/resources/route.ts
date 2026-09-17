import { NextResponse } from 'next/server';
import { requireAuthContext, getErrorStatus } from '@/lib/auth/context';
import { applyNullableBranchScope, assertBranchWritable } from '@/lib/auth/branch-scope';
import { bookingResourceSchema } from '@/lib/booking/schemas';
import { assertFeatureQuota } from '@/lib/subscription/enforcement';
import { subscriptionErrorResponse } from '@/lib/subscription/response';
import { writeAuditLog } from '@/lib/audit/activity-log';

function toInt(v: string | null, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

/**
 * Normalise the optional service link: dedupe, and reject ids that are not
 * live services of this shop so a stale or foreign id never sticks to a resource.
 * Returns `null` when nothing is linked (= serves every service).
 */
async function resolveServiceIds(
  supabase: Awaited<ReturnType<typeof requireAuthContext>>['supabase'],
  shopId: string,
  serviceIds: string[] | null | undefined,
): Promise<{ ok: true; value: string[] | null } | { ok: false; error: string }> {
  const ids = Array.from(new Set(serviceIds ?? []));
  if (ids.length === 0) return { ok: true, value: null };
  const { data, error } = await supabase
    .from('services')
    .select('id')
    .eq('shop_id', shopId)
    .eq('is_deleted', false)
    .in('id', ids);
  if (error) throw error;
  const known = new Set((data ?? []).map((s) => s.id as string));
  if (ids.some((id) => !known.has(id))) return { ok: false, error: 'service_ids มีบริการที่ไม่อยู่ในร้านนี้' };
  return { ok: true, value: ids };
}

function getErrorPayload(e: unknown) {
  if (e && typeof e === 'object') {
    const obj = e as { message?: string; code?: string; details?: string; hint?: string };
    return {
      error: obj.message ?? 'Unexpected error',
      code: obj.code ?? null,
      details: obj.details ?? null,
      hint: obj.hint ?? null,
    };
  }
  return { error: e instanceof Error ? e.message : 'Unexpected error', code: null, details: null, hint: null };
}

export async function GET(req: Request) {
  try {
    const { supabase, profile, branchScope } = await requireAuthContext({ roles: ['super_admin', 'shop_owner', 'branch_manager', 'staff'] });
    const { searchParams } = new URL(req.url);
    const resourceType = searchParams.get('resource_type');
    const branchId = searchParams.get('branch_id');
    const active = searchParams.get('active');
    const zone = searchParams.get('zone');
    const q = searchParams.get('q');
    const page = toInt(searchParams.get('page'), 1);
    const pageSize = Math.min(toInt(searchParams.get('page_size'), 20), 100);

    let query = supabase
      .from('booking_resources')
      .select('*, branches(branch_name)', { count: 'exact' })
      .eq('shop_id', profile.shop_id)
      .eq('is_deleted', false)
      .order('resource_type', { ascending: true })
      .order('resource_code', { ascending: true });

    if (resourceType) query = query.eq('resource_type', resourceType);
    // branch_id NULL = resource shared across the shop, visible to every branch.
    query = applyNullableBranchScope(query, branchScope, branchId);
    if (active === 'true' || active === 'false') query = query.eq('active', active === 'true');
    if (zone) query = query.ilike('zone', `%${zone}%`);
    if (q) query = query.or(`resource_name.ilike.%${q}%,resource_code.ilike.%${q}%,description.ilike.%${q}%`);

    const from = (page - 1) * pageSize;
    const { data, error, count } = await query.range(from, from + pageSize - 1);
    if (error) throw error;
    return NextResponse.json({ data: data ?? [], pagination: { page, page_size: pageSize, total: count ?? 0 } });
  } catch (e) {
    return NextResponse.json(getErrorPayload(e), { status: getErrorStatus(e) });
  }
}

export async function POST(req: Request) {
  try {
    const { supabase, user, profile, branchScope } = await requireAuthContext({ roles: ['super_admin', 'shop_owner', 'branch_manager'] });
    const body = await req.json();
    const normalizedBody = {
      ...body,
      resource_code: typeof body.resource_code === 'string' && body.resource_code.trim() === '' ? null : body.resource_code,
      floor: typeof body.floor === 'string' && body.floor.trim() === '' ? null : body.floor,
      zone: typeof body.zone === 'string' && body.zone.trim() === '' ? null : body.zone,
      description: typeof body.description === 'string' && body.description.trim() === '' ? null : body.description,
    };

    const parsed = bookingResourceSchema.safeParse(normalizedBody);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: parsed.error.issues[0]?.message ?? 'Invalid payload',
          issues: parsed.error.issues,
        },
        { status: 400 },
      );
    }

    const { count: resourceCount } = await supabase
      .from('booking_resources')
      .select('id', { count: 'exact', head: true })
      .eq('shop_id', profile.shop_id)
      .eq('is_deleted', false);
    await assertFeatureQuota(profile.shop_id, 'resources', resourceCount ?? 0);

    const branchId = typeof body.branch_id === 'string' && body.branch_id.trim() ? body.branch_id : null;
    assertBranchWritable(branchScope, branchId);
    if (branchId) {
      const { data: branch, error: branchError } = await supabase
        .from('branches')
        .select('id')
        .eq('id', branchId)
        .eq('shop_id', profile.shop_id)
        .eq('is_deleted', false)
        .maybeSingle();
      if (branchError) throw branchError;
      if (!branch) return NextResponse.json({ error: 'branch_id ไม่ถูกต้องหรือไม่อยู่ในร้านนี้' }, { status: 400 });
    }
    const serviceLink = await resolveServiceIds(supabase, profile.shop_id, parsed.data.service_ids);
    if (!serviceLink.ok) return NextResponse.json({ error: serviceLink.error }, { status: 400 });

    const { error } = await supabase.from('booking_resources').insert({
      company_id: profile.company_id,
      shop_id: profile.shop_id,
      branch_id: branchId,
      resource_type: parsed.data.resource_type,
      resource_code: parsed.data.resource_code || null,
      resource_name: parsed.data.resource_name,
      capacity: parsed.data.capacity,
      unit_price: parsed.data.unit_price,
      floor: parsed.data.floor || null,
      zone: parsed.data.zone || null,
      description: parsed.data.description || null,
      active: parsed.data.active,
      service_ids: serviceLink.value,
      created_by: user.id,
      updated_by: user.id,
    });

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'resource_code นี้ซ้ำในสาขาเดียวกัน' }, { status: 400 });
      }
      if (error.code === '23503') {
        return NextResponse.json({ error: 'ข้อมูลอ้างอิงไม่ถูกต้อง (branch/company/shop)' }, { status: 400 });
      }
      throw error;
    }
    return NextResponse.json({ data: true });
  } catch (e) {
    const quota = subscriptionErrorResponse(e);
    if (quota) return quota;
    return NextResponse.json(getErrorPayload(e), { status: getErrorStatus(e) });
  }
}

export async function PATCH(req: Request) {
  try {
    const { supabase, user, profile, branchScope } = await requireAuthContext({ roles: ['super_admin', 'shop_owner', 'branch_manager'] });
    const body = await req.json();
    const id = String(body.id ?? '');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    const normalizedBody = {
      ...body,
      resource_code: typeof body.resource_code === 'string' && body.resource_code.trim() === '' ? null : body.resource_code,
      floor: typeof body.floor === 'string' && body.floor.trim() === '' ? null : body.floor,
      zone: typeof body.zone === 'string' && body.zone.trim() === '' ? null : body.zone,
      description: typeof body.description === 'string' && body.description.trim() === '' ? null : body.description,
    };
    const parsed = bookingResourceSchema.safeParse(normalizedBody);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: parsed.error.issues[0]?.message ?? 'Invalid payload',
          issues: parsed.error.issues,
        },
        { status: 400 },
      );
    }

    const branchId = typeof body.branch_id === 'string' && body.branch_id.trim() ? body.branch_id : null;
    // Both the branch the resource is moving to and the one it currently sits in.
    assertBranchWritable(branchScope, branchId);
    const { data: currentResource } = await supabase
      .from('booking_resources')
      .select('branch_id')
      .eq('id', id)
      .eq('shop_id', profile.shop_id)
      .maybeSingle();
    if (!currentResource) return NextResponse.json({ error: 'Resource not found' }, { status: 404 });
    assertBranchWritable(branchScope, currentResource.branch_id);
    if (branchId) {
      const { data: branch, error: branchError } = await supabase
        .from('branches')
        .select('id')
        .eq('id', branchId)
        .eq('shop_id', profile.shop_id)
        .eq('is_deleted', false)
        .maybeSingle();
      if (branchError) throw branchError;
      if (!branch) return NextResponse.json({ error: 'branch_id ไม่ถูกต้องหรือไม่อยู่ในร้านนี้' }, { status: 400 });
    }
    const serviceLink = await resolveServiceIds(supabase, profile.shop_id, parsed.data.service_ids);
    if (!serviceLink.ok) return NextResponse.json({ error: serviceLink.error }, { status: 400 });

    const { error } = await supabase
      .from('booking_resources')
      .update({
        branch_id: branchId,
        resource_type: parsed.data.resource_type,
        resource_code: parsed.data.resource_code || null,
        resource_name: parsed.data.resource_name,
        capacity: parsed.data.capacity,
        unit_price: parsed.data.unit_price,
        floor: parsed.data.floor || null,
        zone: parsed.data.zone || null,
        description: parsed.data.description || null,
        active: parsed.data.active,
        service_ids: serviceLink.value,
        updated_by: user.id,
      })
      .eq('id', id)
      .eq('shop_id', profile.shop_id);

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'resource_code นี้ซ้ำในสาขาเดียวกัน' }, { status: 400 });
      }
      if (error.code === '23503') {
        return NextResponse.json({ error: 'ข้อมูลอ้างอิงไม่ถูกต้อง (branch/company/shop)' }, { status: 400 });
      }
      throw error;
    }
    await writeAuditLog({
      companyId: profile.company_id,
      shopId: profile.shop_id,
      userId: user.id,
      action: 'data_updated',
      targetTable: 'booking_resources',
      targetId: id,
      payload: { resource_type: parsed.data.resource_type, resource_name: parsed.data.resource_name, unit_price: parsed.data.unit_price },
    });
    return NextResponse.json({ data: true });
  } catch (e) {
    return NextResponse.json(getErrorPayload(e), { status: getErrorStatus(e) });
  }
}

export async function DELETE(req: Request) {
  try {
    const { supabase, user, profile } = await requireAuthContext({ roles: ['super_admin', 'shop_owner'] });
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const { error } = await supabase
      .from('booking_resources')
      .update({ is_deleted: true, active: false, updated_by: user.id })
      .eq('id', id)
      .eq('shop_id', profile.shop_id);

    if (error) throw error;
    return NextResponse.json({ data: true });
  } catch (e) {
    return NextResponse.json(getErrorPayload(e), { status: getErrorStatus(e) });
  }
}
