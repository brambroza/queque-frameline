import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuthContext, getErrorStatus } from '@/lib/auth/context';
import { applyBranchScope } from '@/lib/auth/branch-scope';
import { createAdminClient } from '@/lib/supabase/admin';
import { assertFeatureQuota } from '@/lib/subscription/enforcement';
import { subscriptionErrorResponse } from '@/lib/subscription/response';
import { writeAuditLog } from '@/lib/audit/activity-log';

/** Roles a shop owner may hand out from the staff screen. Never shop_owner or super_admin. */
const ASSIGNABLE_ROLES = ['branch_manager', 'staff'] as const;

/**
 * Managing staff and their branch assignments is owner-level: a branch_manager who
 * could edit staff_branches would be able to widen their own branch scope.
 */
const STAFF_ADMIN_ROLES = ['super_admin', 'shop_owner'] as const;

const staffSchema = z
  .object({
    /** Existing auth user to attach. Omit and pass `email` to invite a new one. */
    user_id: z.string().uuid().optional(),
    email: z.string().email().optional(),
    role: z.enum(ASSIGNABLE_ROLES).optional(),
    display_name: z.string().min(2),
    active: z.boolean().default(true),
    branch_ids: z.array(z.string().uuid()).default([]),
  })
  .refine((v) => Boolean(v.user_id) || Boolean(v.email), {
    message: 'Either user_id or email is required',
    path: ['user_id'],
  });

/**
 * Create (or reuse) the auth user, profile and role grant for a new staff member.
 *
 * Registration only ever produced shop_owner accounts, so before this there was no
 * way to bring a branch_manager or staff login into existence.
 *
 * @returns The auth user id to attach the staff row to.
 */
async function provisionStaffUser(input: {
  email: string;
  displayName: string;
  role: (typeof ASSIGNABLE_ROLES)[number];
  companyId: string;
  shopId: string;
  actorId: string;
}): Promise<string> {
  const admin = createAdminClient();

  const { data: roleRow, error: roleError } = await admin
    .from('roles')
    .select('id')
    .eq('code', input.role)
    .eq('is_deleted', false)
    .single();
  if (roleError || !roleRow) throw new Error(`Role ${input.role} not found in seed data`);

  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(input.email);
  let userId = invited?.user?.id ?? null;

  if (!userId) {
    // Already registered (or invites are disabled) — fall back to looking the user up.
    const existing = await findAuthUserByEmail(admin, input.email);
    if (!existing) throw new Error(inviteError?.message ?? 'Unable to invite user');
    userId = existing;
  }

  const { error: profileError } = await admin.from('users_profile').upsert({
    id: userId,
    company_id: input.companyId,
    shop_id: input.shopId,
    full_name: input.displayName,
    email: input.email,
    active: true,
    created_by: input.actorId,
    updated_by: input.actorId,
  });
  if (profileError) throw profileError;

  const { data: existingRole } = await admin
    .from('user_roles')
    .select('id')
    .eq('user_id', userId)
    .eq('role_id', roleRow.id)
    .eq('shop_id', input.shopId)
    .eq('is_deleted', false)
    .maybeSingle();

  if (!existingRole) {
    const { error: roleInsertError } = await admin.from('user_roles').insert({
      user_id: userId,
      role_id: roleRow.id,
      company_id: input.companyId,
      shop_id: input.shopId,
      created_by: input.actorId,
      updated_by: input.actorId,
    });
    if (roleInsertError) throw roleInsertError;
  }

  return userId;
}

/** auth.users is not queryable directly, so page through the admin listing. */
async function findAuthUserByEmail(
  admin: ReturnType<typeof createAdminClient>,
  email: string
): Promise<string | null> {
  const target = email.toLowerCase();
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) return null;
    const match = data.users.find((u) => (u.email ?? '').toLowerCase() === target);
    if (match) return match.id;
    if (data.users.length < 200) return null;
  }
  return null;
}

function toInt(v: string | null, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

export async function GET(req: Request) {
  try {
    const { supabase, profile, branchScope } = await requireAuthContext({ roles: ['super_admin', 'shop_owner', 'branch_manager', 'staff'] });
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q');
    const page = toInt(searchParams.get('page'), 1);
    const pageSize = Math.min(toInt(searchParams.get('page_size'), 20), 100);

    // A branch-bound caller only sees colleagues assigned to one of their branches.
    let visibleStaffIds: string[] | null = null;
    if (branchScope !== null) {
      const { data: peers, error: peersError } = await applyBranchScope(
        supabase
          .from('staff_branches')
          .select('staff_id')
          .eq('shop_id', profile.shop_id)
          .eq('is_deleted', false),
        branchScope
      );
      if (peersError) throw peersError;
      visibleStaffIds = Array.from(new Set((peers ?? []).map((r) => r.staff_id as string)));
    }

    let query = supabase
      .from('staff')
      .select('id,user_id,display_name,active,created_at', { count: 'exact' })
      .eq('shop_id', profile.shop_id)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false });

    if (visibleStaffIds) query = query.in('id', visibleStaffIds);
    if (q) query = query.ilike('display_name', `%${q}%`);

    const from = (page - 1) * pageSize;
    const { data: staffs, error, count } = await query.range(from, from + pageSize - 1);
    if (error) throw error;

    const staffIds = (staffs ?? []).map((s) => s.id);

    const [branchMapRes, usersRes, branchesRes] = await Promise.all([
      staffIds.length
        ? supabase
            .from('staff_branches')
            .select('staff_id,branch_id,branches(id,branch_name)')
            .eq('shop_id', profile.shop_id)
            .eq('is_deleted', false)
            .in('staff_id', staffIds)
        : Promise.resolve({ data: [], error: null }),
      supabase
        .from('users_profile')
        .select('id,full_name,email,phone')
        .eq('shop_id', profile.shop_id)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false }),
      applyBranchScope(
        supabase
          .from('branches')
          .select('id,branch_name')
          .eq('shop_id', profile.shop_id)
          .eq('is_deleted', false),
        branchScope,
        null,
        'id',
      ).order('created_at', { ascending: false }),
    ]);

    if (branchMapRes.error) throw branchMapRes.error;
    if (usersRes.error) throw usersRes.error;
    if (branchesRes.error) throw branchesRes.error;

    const grouped = new Map<string, Array<{ id: string; branch_name: string }>>();
    (branchMapRes.data ?? []).forEach((r) => {
      const arr = grouped.get(r.staff_id) ?? [];
      const b = r.branches as { id?: string; branch_name?: string } | null;
      if (b?.id) arr.push({ id: b.id, branch_name: b.branch_name ?? '-' });
      grouped.set(r.staff_id, arr);
    });

    const rows = (staffs ?? []).map((s) => ({ ...s, branches: grouped.get(s.id) ?? [] }));

    return NextResponse.json({
      data: rows,
      refs: {
        users: usersRes.data ?? [],
        branches: branchesRes.data ?? [],
      },
      pagination: { page, page_size: pageSize, total: count ?? 0 },
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}

export async function POST(req: Request) {
  try {
    const { supabase, user, profile } = await requireAuthContext({ roles: [...STAFF_ADMIN_ROLES] });
    const parsed = staffSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: 'Invalid payload', issues: parsed.error.issues }, { status: 400 });
    if (!profile.company_id || !profile.shop_id) {
      return NextResponse.json({ error: 'Profile is missing company/shop context' }, { status: 400 });
    }

    const payload = parsed.data;
    const { count: staffCount } = await supabase
      .from('staff')
      .select('id', { count: 'exact', head: true })
      .eq('shop_id', profile.shop_id)
      .eq('is_deleted', false);
    await assertFeatureQuota(profile.shop_id, 'staff', staffCount ?? 0);

    const staffUserId = payload.user_id
      ? payload.user_id
      : await provisionStaffUser({
          email: payload.email!,
          displayName: payload.display_name,
          role: payload.role ?? 'staff',
          companyId: profile.company_id,
          shopId: profile.shop_id,
          actorId: user.id,
        });

    const { data: existed } = await supabase
      .from('staff')
      .select('id')
      .eq('shop_id', profile.shop_id)
      .eq('user_id', staffUserId)
      .eq('is_deleted', false)
      .maybeSingle();
    if (existed) return NextResponse.json({ error: 'This user is already staff in this shop' }, { status: 400 });

    const { data: inserted, error } = await supabase
      .from('staff')
      .insert({
        user_id: staffUserId,
        company_id: profile.company_id,
        shop_id: profile.shop_id,
        display_name: payload.display_name,
        active: payload.active,
        created_by: user.id,
        updated_by: user.id,
      })
      .select('id')
      .single();

    if (error || !inserted) throw error ?? new Error('Create staff failed');

    const { error: mapError } = await supabase.rpc('set_staff_branches', {
      p_staff_id: inserted.id,
      p_shop_id: profile.shop_id,
      p_branch_ids: payload.branch_ids,
      p_actor: user.id,
    });
    if (mapError) throw mapError;

    return NextResponse.json({ data: true });
  } catch (e) {
    const quota = subscriptionErrorResponse(e);
    if (quota) return quota;
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}

export async function PATCH(req: Request) {
  try {
    const { supabase, user, profile } = await requireAuthContext({ roles: [...STAFF_ADMIN_ROLES] });
    const body = await req.json();
    const id = body.id as string;
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const parsed = staffSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: 'Invalid payload', issues: parsed.error.issues }, { status: 400 });

    const payload = parsed.data;

    const { error } = await supabase
      .from('staff')
      .update({
        ...(payload.user_id ? { user_id: payload.user_id } : {}),
        display_name: payload.display_name,
        active: payload.active,
        updated_by: user.id,
      })
      .eq('id', id)
      .eq('shop_id', profile.shop_id);

    if (error) throw error;

    // One transaction: never leaves the member with zero branches if the write fails.
    const { error: mapError } = await supabase.rpc('set_staff_branches', {
      p_staff_id: id,
      p_shop_id: profile.shop_id,
      p_branch_ids: payload.branch_ids,
      p_actor: user.id,
    });
    if (mapError) throw mapError;

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
      .from('staff')
      .update({ is_deleted: true, active: false, updated_by: user.id })
      .eq('id', id)
      .eq('shop_id', profile.shop_id);
    if (error) throw error;

    await supabase
      .from('staff_branches')
      .update({ is_deleted: true, updated_by: user.id })
      .eq('staff_id', id)
      .eq('shop_id', profile.shop_id)
      .eq('is_deleted', false);

    await writeAuditLog({
      companyId: profile.company_id,
      shopId: profile.shop_id,
      userId: user.id,
      action: 'data_deleted',
      targetTable: 'staff',
      targetId: id,
      payload: { soft_delete: true, cascade_soft_delete: ['staff_branches'] },
    });

    return NextResponse.json({ data: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}
