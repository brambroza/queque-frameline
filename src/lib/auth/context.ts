import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { AppRole } from '@/types/db';
import { AuthError } from './errors';
import { resolveBranchScope, type BranchScope } from './branch-scope';

export { AuthError };
export type { BranchScope };

/** Tenant context of the caller. Single-site deployment: one company, one shop. */
export type AuthProfile = { company_id: string; shop_id: string };
/** Raw `users_profile` tenant columns before hydration. */
type ProfileRow = { company_id: string | null; shop_id: string | null };

function ensureRole(userRoles: AppRole[], required: AppRole[]) {
  return required.some((r) => userRoles.includes(r));
}

/** Narrow a `roles.access_level` value to the app's role tiers. */
export function isAppRole(v: unknown): v is AppRole {
  return v === 'admin' || v === 'staff';
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
 * Resolve the signed-in user's profile, roles and branch scope for an API route.
 *
 * Throws `AuthError(401)` when there is no session and `AuthError(403)` when
 * `opts.roles` is given and the caller holds none of them. A missing
 * `users_profile` row is created on the fly (service role) so a freshly
 * invited account can use the portal without a manual fix.
 *
 * @param opts.roles Roles allowed to call the route; omit to allow any signed-in user.
 * @returns Session-scoped Supabase client, auth user, tenant profile, role tiers (`roles`), raw role codes and branch scope.
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
  if (roleIds.length > 0) {
    const { data: roleDefs, error: roleDefsError } = await supabase
      .from('roles')
      .select('code, access_level')
      .in('id', roleIds)
      .eq('is_deleted', false);
    if (roleDefsError) throw new AuthError('Unable to read role definitions', 403);
    const defs = (roleDefs ?? []) as Array<{ code: string | null; access_level: string | null }>;
    roleCodes = defs.map((r) => r.code).filter((c): c is string => Boolean(c));
    // Route guards check the access level, so a custom role ("gate", "finance")
    // acts as the tier it was created with.
    roles = Array.from(new Set(defs.map((r) => r.access_level).filter(isAppRole)));
  }

  if (opts?.roles?.length && !ensureRole(roles, opts.roles)) {
    throw new AuthError(`Forbidden (roles=${roles.join(',') || 'none'})`, 403);
  }

  // Branches this caller may read/write. `null` = every branch of the shop.
  const branchScope = await resolveBranchScope(supabase, user.id, tenantProfile.shop_id, roles);

  return { supabase, user, profile: tenantProfile, roles, roleCodes, branchScope };
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
