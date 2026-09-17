import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { AppRole } from '@/types/db';
import { AuthError } from './errors';
import { resolveBranchScope, type BranchScope } from './branch-scope';
import { applyActingShop, readAdminShopCookie, resolveActingShop } from './admin-shop-cookie';

export { AuthError };
export type { BranchScope };

function ensureRole(userRoles: AppRole[], required: AppRole[]) {
  return required.some((r) => userRoles.includes(r));
}

/**
 * Keep only the role grants that apply to the shop the caller is acting in.
 *
 * A user can hold roles in several shops; without this filter a `shop_owner` grant
 * in shop A would leak shop-wide privileges (and shop-wide branch scope) into shop B.
 * Rows with a null `shop_id` are global grants (e.g. super_admin) and always count.
 * When the profile has no shop yet, nothing is filtered out so tenant hydration
 * further down can still recover the context.
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

export async function requireAuthContext(opts?: { roles?: AppRole[] }) {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) throw new AuthError('Unauthorized', 401);

  let { data: profile, error: profileError } = await supabase
    .from('users_profile')
    .select('company_id, shop_id')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    // Auto-heal missing profile for authenticated users.
    // Use service-role client to avoid RLS deadlock when the profile row does not exist yet.
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
      const refetch = await supabase
        .from('users_profile')
        .select('company_id, shop_id')
        .eq('id', user.id)
        .single();
      profile = refetch.data;
      profileError = refetch.error;
    }

    if (profileError || !profile) {
      profile = {
        company_id: null,
        shop_id: null,
      };
    }
  }

  const { data: roleRows, error: roleError } = await supabase
    .from('user_roles')
    .select('role_id, shop_id')
    .eq('user_id', user.id)
    .eq('is_deleted', false);

  if (roleError) throw new AuthError('Unable to read roles', 403);

  const roleIds = pickRoleIdsForShop(roleRows, profile.shop_id);
  let roles: AppRole[] = [];

  if (roleIds.length > 0) {
    const { data: roleDefs, error: roleDefsError } = await supabase
      .from('roles')
      .select('code')
      .in('id', roleIds)
      .eq('is_deleted', false);

    if (roleDefsError) throw new AuthError('Unable to read role definitions', 403);
    roles = (roleDefs ?? []).map((r) => r.code).filter(Boolean) as AppRole[];
  }

  if (opts?.roles?.length && !ensureRole(roles, opts.roles)) {
    // Fallback for legacy accounts: if profile is tied to a shop,
    // treat as shop_owner when user_roles is missing.
    if (profile.shop_id && !roles.includes('shop_owner')) {
      roles.push('shop_owner');
    }

    // Backward-compatible fallback: allow shop creator as shop_owner
    // even when user_roles data is missing/incomplete.
    if (opts.roles.includes('shop_owner') && profile.shop_id) {
      const { data: shop, error: shopError } = await supabase
        .from('shops')
        .select('created_by')
        .eq('id', profile.shop_id)
        .single();

      if (!shopError && shop?.created_by === user.id) {
        roles.push('shop_owner');
      }
    }

    // Final fallback: read roles through service-role client by user_id.
    // This bypasses RLS/policy edge-cases for legacy or partially-migrated users.
    if (!ensureRole(roles, opts.roles)) {
      const admin = createAdminClient();
      const { data: adminRoleRows, error: adminRoleRowsError } = await admin
        .from('user_roles')
        .select('role_id, shop_id')
        .eq('user_id', user.id)
        .eq('is_deleted', false);

      if (!adminRoleRowsError && (adminRoleRows?.length ?? 0) > 0) {
        const adminRoleIds = pickRoleIdsForShop(adminRoleRows, profile.shop_id);
        const { data: adminRoleDefs, error: adminRoleDefsError } = await admin
          .from('roles')
          .select('code')
          .in('id', adminRoleIds)
          .eq('is_deleted', false);

        if (!adminRoleDefsError) {
          const recovered = (adminRoleDefs ?? []).map((r) => r.code).filter(Boolean) as AppRole[];
          recovered.forEach((r) => {
            if (!roles.includes(r)) roles.push(r);
          });
      }
    }
  }

  // If profile has no tenant context but user_roles has one, hydrate profile context.
  if (!profile.company_id || !profile.shop_id) {
    const { data: tenantRoleRows, error: tenantRoleError } = await supabase
      .from('user_roles')
      .select('company_id,shop_id')
      .eq('user_id', user.id)
      .eq('is_deleted', false)
      .not('shop_id', 'is', null)
      .order('created_at', { ascending: true })
      .limit(1);

    if (!tenantRoleError && (tenantRoleRows?.length ?? 0) > 0) {
      const tenant = tenantRoleRows![0];
      if (tenant.company_id && tenant.shop_id) {
        profile = {
          company_id: tenant.company_id,
          shop_id: tenant.shop_id,
        };

        // Best-effort profile sync to avoid repeating fallback every request.
        try {
          const admin = createAdminClient();
          await admin
            .from('users_profile')
            .update({ company_id: tenant.company_id, shop_id: tenant.shop_id, updated_by: user.id })
            .eq('id', user.id);
        } catch {
          // no-op
        }
      }
    }
  }

    if (!ensureRole(roles, opts.roles)) {
      throw new AuthError(`Forbidden (roles=${roles.join(',') || 'none'})`, 403);
    }
  }

  // A global super_admin acts in whichever shop they picked in the portal topbar.
  // The choice lives in a request-scoped cookie and is never written to users_profile,
  // so the account stays global. `roles` is not re-resolved: super_admin already passes
  // every gate that lists it, and resolveBranchScope grants it the whole shop.
  if (roles.includes('super_admin')) {
    const cookieShopId = await readAdminShopCookie();
    if (cookieShopId) {
      const acting = await resolveActingShop(createAdminClient(), cookieShopId);
      profile = applyActingShop(profile, roles, acting);
    }
  }

  // Branches this caller may read/write. `null` = every branch of the shop.
  const branchScope = await resolveBranchScope(supabase, user.id, profile.shop_id, roles);

  return { supabase, user, profile, roles, branchScope };
}

export function getErrorStatus(e: unknown): number {
  if (e instanceof AuthError) return e.status;
  // Subscription errors carry their own status (402 quota wall / 403 suspended)
  // so route handlers do not have to special-case them.
  if (e && typeof e === 'object' && 'status' in e) {
    const status = Number((e as { status: unknown }).status);
    if (Number.isInteger(status) && status >= 400 && status <= 599) return status;
  }
  return 400;
}
