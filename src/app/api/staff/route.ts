import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuthContext, getErrorStatus } from '@/lib/auth/context';
import { applyBranchScope } from '@/lib/auth/branch-scope';
import { createAdminClient } from '@/lib/supabase/admin';
import { writeAuditLog } from '@/lib/audit/activity-log';
import { ROLE_SELECT, countOtherAdmins, findRoleByCode, revokeUserRoles, rolesOfUser, setUserRole, type RoleDef } from '@/lib/auth/role-grants';

/** Role codes come from the admin-managed `roles` table (see /api/roles). */
const roleCodeSchema = z.string().trim().regex(/^[a-z][a-z0-9_]{1,31}$/);

/**
 * Managing staff and their branch assignments is owner-level: a branch_manager who
 * could edit staff_branches would be able to widen their own branch scope.
 */
const STAFF_ADMIN_ROLES = ['admin'] as const;

const staffSchema = z
  .object({
    /** Existing auth user to attach. Omit and pass `email` to invite a new one. */
    user_id: z.string().uuid().optional(),
    email: z.string().email().optional(),
    role: roleCodeSchema.optional(),
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
  role: RoleDef;
  companyId: string;
  shopId: string;
  actorId: string;
}): Promise<string> {
  const admin = createAdminClient();

  // The email link lands on /auth/callback, which turns the code into a session and opens /set-password.
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/+$/, '');
  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(input.email, {
    data: { full_name: input.displayName },
    redirectTo: appUrl ? `${appUrl}/auth/callback?next=/set-password` : undefined,
  });
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

  await setUserRole(admin, { userId, roleId: input.role.id, shopId: input.shopId, companyId: input.companyId, actorId: input.actorId });

  return userId;
}

/**
 * Give a member a (different) role. Refuses to change the caller's own role and
 * to demote the last admin-level user, so the site can never lock itself out.
 */
async function changeMemberRole(input: {
  targetUserId: string;
  role: RoleDef;
  actorId: string;
  shopId: string;
  companyId: string;
}): Promise<NextResponse | null> {
  const admin = createAdminClient();
  if (input.targetUserId === input.actorId) return NextResponse.json({ error: 'เปลี่ยนสิทธิ์ของตัวเองไม่ได้ — ให้ผู้ดูแลระบบคนอื่นทำ' }, { status: 400 });
  const current = await rolesOfUser(admin, input.targetUserId, input.shopId);
  const wasAdmin = current.some((r) => r.access_level === 'admin');
  if (wasAdmin && input.role.access_level !== 'admin' && (await countOtherAdmins(admin, input.shopId, input.targetUserId)) === 0) {
    return NextResponse.json({ error: 'ต้องมีผู้ดูแลระบบอย่างน้อย 1 คน' }, { status: 400 });
  }
  await setUserRole(admin, { userId: input.targetUserId, roleId: input.role.id, shopId: input.shopId, companyId: input.companyId, actorId: input.actorId });
  return null;
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
    const { supabase, profile, branchScope } = await requireAuthContext({ roles: ['admin', 'staff'] });
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
    const userIds = (staffs ?? []).map((s) => s.user_id as string);

    const [branchMapRes, usersRes, branchesRes, rolesRes, grantsRes] = await Promise.all([
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
      supabase.from('roles').select(ROLE_SELECT).eq('is_deleted', false).order('sort_order').order('created_at'),
      userIds.length
        ? supabase.from('user_roles').select('user_id, roles!inner(code,name,access_level,is_deleted)').eq('shop_id', profile.shop_id).eq('is_deleted', false).eq('roles.is_deleted', false).in('user_id', userIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (branchMapRes.error) throw branchMapRes.error;
    if (usersRes.error) throw usersRes.error;
    if (branchesRes.error) throw branchesRes.error;
    if (rolesRes.error) throw rolesRes.error;
    if (grantsRes.error) throw grantsRes.error;

    const roleByUser = new Map<string, { code: string; name: string; access_level: string }>();
    (grantsRes.data ?? []).forEach((g) => {
      const r = (g as unknown as { user_id: string; roles: { code: string; name: string; access_level: string } | null }).roles;
      if (r) roleByUser.set((g as { user_id: string }).user_id, r);
    });

    const grouped = new Map<string, Array<{ id: string; branch_name: string }>>();
    (branchMapRes.data ?? []).forEach((r) => {
      const arr = grouped.get(r.staff_id) ?? [];
      const b = r.branches as { id?: string; branch_name?: string } | null;
      if (b?.id) arr.push({ id: b.id, branch_name: b.branch_name ?? '-' });
      grouped.set(r.staff_id, arr);
    });

    const rows = (staffs ?? []).map((s) => ({ ...s, branches: grouped.get(s.id) ?? [], role: roleByUser.get(s.user_id as string) ?? null }));

    return NextResponse.json({
      data: rows,
      refs: {
        users: usersRes.data ?? [],
        branches: branchesRes.data ?? [],
        roles: rolesRes.data ?? [],
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
    const role = await findRoleByCode(createAdminClient(), payload.role ?? 'staff');
    if (!role) return NextResponse.json({ error: 'ไม่พบสิทธิ์ที่เลือก' }, { status: 400 });

    let staffUserId: string;
    if (payload.user_id) {
      staffUserId = payload.user_id;
      // Attaching an existing account: the picked role replaces whatever it had.
      if (payload.role) {
        const denied = await changeMemberRole({ targetUserId: staffUserId, role, actorId: user.id, shopId: profile.shop_id, companyId: profile.company_id });
        if (denied) return denied;
      }
    } else {
      staffUserId = await provisionStaffUser({
        email: payload.email!,
        displayName: payload.display_name,
        role,
        companyId: profile.company_id,
        shopId: profile.shop_id,
        actorId: user.id,
      });
    }

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

    if (payload.role) {
      const { data: target } = await supabase.from('staff').select('user_id').eq('id', id).eq('shop_id', profile.shop_id).eq('is_deleted', false).maybeSingle();
      if (!target) return NextResponse.json({ error: 'ไม่พบพนักงาน' }, { status: 404 });
      const role = await findRoleByCode(createAdminClient(), payload.role);
      if (!role) return NextResponse.json({ error: 'ไม่พบสิทธิ์ที่เลือก' }, { status: 400 });
      const denied = await changeMemberRole({ targetUserId: target.user_id as string, role, actorId: user.id, shopId: profile.shop_id, companyId: profile.company_id });
      if (denied) return denied;
    }

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
    const { supabase, user, profile } = await requireAuthContext({ roles: ['admin'] });
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const { data: target } = await supabase.from('staff').select('user_id').eq('id', id).eq('shop_id', profile.shop_id).eq('is_deleted', false).maybeSingle();
    if (!target) return NextResponse.json({ error: 'ไม่พบพนักงาน' }, { status: 404 });
    const targetUserId = target.user_id as string;
    if (targetUserId === user.id) return NextResponse.json({ error: 'ลบบัญชีของตัวเองไม่ได้' }, { status: 400 });
    const admin = createAdminClient();
    const wasAdmin = (await rolesOfUser(admin, targetUserId, profile.shop_id)).some((r) => r.access_level === 'admin');
    if (wasAdmin && (await countOtherAdmins(admin, profile.shop_id, targetUserId)) === 0) {
      return NextResponse.json({ error: 'ต้องมีผู้ดูแลระบบอย่างน้อย 1 คน' }, { status: 400 });
    }

    const { error } = await supabase
      .from('staff')
      .update({ is_deleted: true, active: false, updated_by: user.id })
      .eq('id', id)
      .eq('shop_id', profile.shop_id);
    if (error) throw error;

    // Removing a member also ends their login rights; before this the grant lingered.
    await revokeUserRoles(admin, { userId: targetUserId, shopId: profile.shop_id, actorId: user.id });

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
      payload: { soft_delete: true, cascade_soft_delete: ['staff_branches', 'user_roles'] },
    });

    return NextResponse.json({ data: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}
