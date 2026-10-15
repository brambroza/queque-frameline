import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { AppRole } from '@/types/db';
import { AuthError } from './errors';
import type { BranchScope } from './branch-scope';
import { effectiveLevels, isAppRole } from './levels';
import { ROLE_CAPABILITY_SELECT, applyStaffBranches, resolveCapabilities, type RoleAccessDef } from './role-capabilities';
import { resolveWriteKeys, type MenuKey, type RoleWriteDef } from './menu-registry';

export { AuthError, isAppRole };
export type { BranchScope };

/** Tenant context of the caller. Single-site deployment: one company, one shop. */
export type AuthProfile = { company_id: string; shop_id: string };
/** Raw `users_profile` tenant columns before hydration. */
type ProfileRow = { company_id: string | null; shop_id: string | null };

function ensureRole(userRoles: AppRole[], required: AppRole[]) {
  return required.some((r) => userRoles.includes(r));
}

/**
 * Keep only the role grants that apply to the shop the caller is acting in.
 * Rows with a null `shop_id` are global grants and always count. When the
 * profile has no shop yet, nothing is filtered out so tenant hydration further
 * down can still recover the context.
 *
 * @param rows Raw `user_roles` rows carrying `role_id` and `shop_id`.
 * @param shopId Shop the caller is acting in, or null when not yet known.
 * @returns Role ids that apply in this tenant.
 */
function pickRoleIdsForShop(
  rows: Array<{ role_id: string | null; shop_id: string | null }> | null,
  shopId: string | null
): string[] {
  return (rows ?? [])
    .filter((r) => !shopId || !r.shop_id || r.shop_id === shopId)
    .map((r) => r.role_id)
    .filter((id): id is string => Boolean(id));
}

/**
 * Branches assigned to the caller as a staff member (`staff_branches`, live rows only).
 * Empty when the user has no staff row or no assignment.
 */
async function readStaffBranchIds(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, shopId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('staff')
    .select('staff_branches(branch_id, is_deleted)')
    .eq('user_id', userId)
    .eq('shop_id', shopId)
    .eq('is_deleted', false);
  if (error || !data) return [];
  const ids: string[] = [];
  (data as Array<{ staff_branches: Array<{ branch_id: string | null; is_deleted: boolean | null }> | null }>).forEach((row) => {
    (row.staff_branches ?? []).forEach((sb) => {
      if (!sb.is_deleted && sb.branch_id) ids.push(sb.branch_id);
    });
  });
  return ids;
}

/**
 * Resolve the signed-in user's profile, roles and branch scope for an API route.
 *
 * Throws `AuthError(401)` when there is no session and `AuthError(403)` when
 * `opts.roles` is given and the caller holds none of them. A missing
 * `users_profile` row is created on the fly (service role) so a freshly
 * invited account can use the portal without a manual fix.
 *
 * @param opts.roles Levels allowed to call the route; omit to allow any signed-in user. A read-only
 *   (`viewer`) caller passes only when `'viewer'` is listed — never list it on a route that writes.
 * @returns Session-scoped Supabase client, auth user, tenant profile, role tiers (`roles`), raw role codes, branch scope and role capabilities.
 */
export async function requireAuthContext(opts?: { roles?: AppRole[] }) {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) throw new AuthError('Unauthorized', 401);

  let profile: ProfileRow | null = null;
  const { data: profileRow } = await supabase
    .from('users_profile')
    .select('company_id, shop_id')
    .eq('id', user.id)
    .maybeSingle();
  profile = (profileRow as ProfileRow | null) ?? null;

  if (!profile) {
    // Auto-heal a missing profile. Service role: the row does not exist yet, so
    // the session client's own RLS would block the insert.
    const admin = createAdminClient();
    const { error: insertProfileError } = await admin.from('users_profile').upsert({
      id: user.id,
      email: user.email ?? null,
      full_name: (user.user_metadata as { full_name?: string } | null)?.full_name ?? null,
      active: true,
      created_by: user.id,
      updated_by: user.id,
    });
    if (!insertProfileError) {
      const refetch = await supabase.from('users_profile').select('company_id, shop_id').eq('id', user.id).maybeSingle();
      profile = (refetch.data as ProfileRow | null) ?? null;
    }
    if (!profile) profile = { company_id: null, shop_id: null };
  }

  const { data: roleRows, error: roleError } = await supabase
    .from('user_roles')
    .select('role_id, shop_id, company_id')
    .eq('user_id', user.id)
    .eq('is_deleted', false);
  if (roleError) throw new AuthError('Unable to read roles', 403);

  // Profile without tenant context: adopt the tenant of the first role grant and
  // persist it (best effort) so the fallback is not repeated on every request.
  if (!profile.company_id || !profile.shop_id) {
    const tenant = (roleRows ?? []).find((r) => r.shop_id && r.company_id);
    if (tenant) {
      profile = { company_id: tenant.company_id as string, shop_id: tenant.shop_id as string };
      try {
        await createAdminClient()
          .from('users_profile')
          .update({ company_id: profile.company_id, shop_id: profile.shop_id, updated_by: user.id })
          .eq('id', user.id);
      } catch {
        // no-op: hydration is a convenience, not a requirement
      }
    }
  }

  if (!profile.company_id || !profile.shop_id) {
    throw new AuthError('Account is not linked to the site yet', 403);
  }
  const tenantProfile: AuthProfile = { company_id: profile.company_id, shop_id: profile.shop_id };

  const roleIds = pickRoleIdsForShop(roleRows, tenantProfile.shop_id);
  let roles: AppRole[] = [];
  let roleCodes: string[] = [];
  let accessDefs: RoleAccessDef[] = [];
  let writeDefs: RoleWriteDef[] = [];
  if (roleIds.length > 0) {
    type RoleRow = { code: string | null; access_level: string | null; menu_keys?: string[] | null; write_keys?: string[] | null; branch_ids?: string[] | null; can_export?: boolean | null; multi_branch?: boolean | null };
    // Column sets by migration: write_keys (202610150003) > capabilities (202609290001) > tiers only.
    // Until a migration is applied, the narrower select keeps the portal working with the older behaviour.
    const selects = [
      `code, access_level, menu_keys, write_keys, ${ROLE_CAPABILITY_SELECT}`,
      `code, access_level, menu_keys, ${ROLE_CAPABILITY_SELECT}`,
      'code, access_level, menu_keys',
    ];
    let defs: RoleRow[] | null = null;
    for (const sel of selects) {
      const res = await supabase.from('roles').select(sel).in('id', roleIds).eq('is_deleted', false);
      if (!res.error) {
        defs = (res.data ?? []) as unknown as RoleRow[];
        break;
      }
    }
    if (!defs) throw new AuthError('Unable to read role definitions', 403);
    roleCodes = defs.map((r) => r.code).filter((c): c is string => Boolean(c));
    // Route guards check the access level, so a custom role ("gate", "finance")
    // acts as the tier it was created with. A manager also counts as staff; a
    // viewer counts as nothing else, so only guards that name it let it in.
    roles = effectiveLevels(defs.map((r) => r.access_level).filter(isAppRole));
    const live = defs.filter((r): r is RoleRow & { access_level: AppRole } => isAppRole(r.access_level));
    accessDefs = live.map((r) => ({ access_level: r.access_level, branch_ids: r.branch_ids, can_export: r.can_export, multi_branch: r.multi_branch }));
    writeDefs = live.map((r) => ({ access_level: r.access_level, menu_keys: r.menu_keys, write_keys: r.write_keys, code: r.code }));
  }

  if (opts?.roles?.length && !ensureRole(roles, opts.roles)) {
    throw new AuthError(`Forbidden (roles=${roles.join(',') || 'none'})`, 403);
  }

  // Branches this caller may read/write (`null` = every branch) and the role switches.
  const roleCapabilities = resolveCapabilities(accessDefs);
  // A staff member may additionally be pinned to branches on /portal/staff
  // ("สาขาที่รับผิดชอบ"); that list narrows the role scope further. Read errors
  // fall back to the role scope so a missing table never widens access by throwing.
  const staffBranchIds = await readStaffBranchIds(supabase, user.id, tenantProfile.shop_id);
  const branchScope: BranchScope = applyStaffBranches(roleCapabilities.branchScope, staffBranchIds, roles.includes('admin'));
  const capabilities = { ...roleCapabilities, branchScope };
  // Menus whose write actions the caller may use ("แก้ไขได้" per menu, union over roles).
  const writeKeys: MenuKey[] = resolveWriteKeys(writeDefs);

  return { supabase, user, profile: tenantProfile, roles, roleCodes, branchScope, capabilities, writeKeys };
}

/**
 * HTTP status for an error thrown inside a route handler.
 * `AuthError` carries its own status; any object with a 4xx/5xx `status` is honoured; else 400.
 */
export function getErrorStatus(e: unknown): number {
  if (e instanceof AuthError) return e.status;
  if (e && typeof e === 'object' && 'status' in e) {
    const status = Number((e as { status: unknown }).status);
    if (Number.isInteger(status) && status >= 400 && status <= 599) return status;
  }
  return 400;
}
