import { NextResponse } from 'next/server';
import { requireAuthContext, getErrorStatus } from '@/lib/auth/context';
import { applyBranchScope, assertBranchAllowed } from '@/lib/auth/branch-scope';
import { branchSchema } from '@/lib/booking/schemas';
import { createAdminClient } from '@/lib/supabase/admin';
import { assertFeatureQuota } from '@/lib/subscription/enforcement';
import { subscriptionErrorResponse } from '@/lib/subscription/response';
import { writeAuditLog } from '@/lib/audit/activity-log';

function toInt(v: string | null, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

export async function GET(req: Request) {
  try {
    const { supabase, profile, branchScope } = await requireAuthContext({ roles: ['super_admin', 'shop_owner', 'branch_manager', 'staff'] });
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q');
    const active = searchParams.get('active');
    const page = toInt(searchParams.get('page'), 1);
    const pageSize = Math.min(toInt(searchParams.get('page_size'), 20), 100);

    let query = supabase
      .from('branches')
      .select('*', { count: 'exact' })
      .eq('shop_id', profile.shop_id)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false });

    // The branch list drives every branch picker in the portal, so it must already
    // be narrowed to what the caller may access. Scope lives on `id` here, not `branch_id`.
    query = applyBranchScope(query, branchScope, null, 'id');

    if (q) query = query.or(`branch_name.ilike.%${q}%,address.ilike.%${q}%`);
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
    // Creating a branch is an owner-level act: a branch_manager is bound to the
    // branches assigned to them and could not see a branch they created.
    const { supabase, user, profile, roles } = await requireAuthContext({ roles: ['super_admin', 'shop_owner'] });
    const body = await req.json();
    const parsed = branchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Invalid payload',
          issues: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        },
        { status: 400 },
      );
    }

    let targetCompanyId = profile.company_id;
    let targetShopId = profile.shop_id;

    if ((!targetCompanyId || !targetShopId) && roles.includes('super_admin')) {
      const requestedShopId = typeof body.shop_id === 'string' && body.shop_id ? body.shop_id : null;
      const admin = createAdminClient();

      const shopQuery = admin
        .from('shops')
        .select('id, company_id')
        .eq('is_deleted', false)
        .order('created_at', { ascending: true })
        .limit(1);

      const { data: shop, error: shopError } = requestedShopId
        ? await admin.from('shops').select('id, company_id').eq('id', requestedShopId).eq('is_deleted', false).single()
        : await shopQuery.single();

      if (shopError || !shop) {
        return NextResponse.json(
          {
            error: 'No valid shop context found. Provide shop_id in payload or create a shop first.',
            debug: { requested_shop_id: requestedShopId, role_context: roles },
          },
          { status: 400 },
        );
      }

      targetCompanyId = shop.company_id;
      targetShopId = shop.id;
    }

    if (!targetCompanyId || !targetShopId) {
      const admin = createAdminClient();
      const { data: ownShop } = await admin
        .from('shops')
        .select('id, company_id')
        .eq('created_by', user.id)
        .eq('is_deleted', false)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (ownShop) {
        targetCompanyId = ownShop.company_id;
        targetShopId = ownShop.id;
      }
    }

    if (!targetCompanyId || !targetShopId) {
      return NextResponse.json(
        {
          error: 'Profile is missing company/shop context. Please login with a shop account or send shop_id (super admin only).',
          debug: { company_id: profile.company_id, shop_id: profile.shop_id, roles },
        },
        { status: 400 },
      );
    }

    const payload = parsed.data;
    const { count: branchCount } = await createAdminClient()
      .from('branches')
      .select('id', { count: 'exact', head: true })
      .eq('shop_id', targetShopId)
      .eq('is_deleted', false);
    await assertFeatureQuota(targetShopId, 'branches', branchCount ?? 0);

    const branchInsertPayload = {
      company_id: targetCompanyId,
      shop_id: targetShopId,
      branch_name: payload.branch_name,
      address: payload.address,
      phone: payload.phone,
      open_time: payload.open_time,
      close_time: payload.close_time,
      max_parallel_queues: payload.max_parallel_queues,
      active: payload.active,
      created_by: user.id,
      updated_by: user.id,
    };

    const branchClient = roles.includes('super_admin') ? createAdminClient() : supabase;
    const { error } = await branchClient.from('branches').insert(branchInsertPayload);

    if (error) {
      return NextResponse.json(
        {
          error: error.message,
          debug: {
            code: error.code,
            details: error.details,
            hint: error.hint,
            role_context: roles,
            shop_id: targetShopId,
          },
        },
        { status: 400 },
      );
    }

    return NextResponse.json({ data: true });
  } catch (e) {
    const quota = subscriptionErrorResponse(e);
    if (quota) return quota;
    console.log("error : branch :>>> " , e);
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}

export async function PATCH(req: Request) {
  try {
    const { supabase, user, profile, branchScope } = await requireAuthContext({ roles: ['super_admin', 'shop_owner', 'branch_manager'] });
    const body = await req.json();
    const id = body.id as string;
    const parsed = branchSchema.safeParse(body);
    if (!id || !parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    assertBranchAllowed(branchScope, id);

    const { error } = await supabase
      .from('branches')
      .update({
        branch_name: parsed.data.branch_name,
        address: parsed.data.address,
        phone: parsed.data.phone,
        open_time: parsed.data.open_time,
        close_time: parsed.data.close_time,
        max_parallel_queues: parsed.data.max_parallel_queues,
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
      action: 'data_updated',
      targetTable: 'branches',
      targetId: id,
      payload: { branch_name: parsed.data.branch_name, active: parsed.data.active },
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
      .from('branches')
      .update({ is_deleted: true, active: false, updated_by: user.id })
      .eq('id', id)
      .eq('shop_id', profile.shop_id);

    if (error) throw error;
    return NextResponse.json({ data: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}
