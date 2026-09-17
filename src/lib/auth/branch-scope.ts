import type { SupabaseClient } from '@supabase/supabase-js';
import type { AppRole } from '@/types/db';
import { AuthError } from './errors';

/**
 * Branches the caller is allowed to see.
 * `null` means every branch of the shop (super_admin / shop_owner).
 * An empty array means the caller is bound to no branch yet — they see nothing.
 */
export type BranchScope = string[] | null;

/** Roles that always see the whole shop, so no branch lookup is needed. */
const SHOP_WIDE_ROLES: AppRole[] = ['super_admin', 'shop_owner'];

/**
 * Minimal shape of a Supabase filter builder — enough to attach branch predicates.
 * Return types are `unknown` on purpose: a self-referential generic constraint against
 * PostgrestFilterBuilder makes TypeScript give up with "type instantiation is
 * excessively deep". The helpers below cast back to the caller's own builder type.
 */
type BranchFilterOps = {
  eq: (column: string, value: unknown) => unknown;
  in: (column: string, values: readonly unknown[]) => unknown;
  is: (column: string, value: null) => unknown;
  or: (filters: string) => unknown;
};

/** Sentinel so an empty scope matches no row instead of every row. */
const NO_BRANCH = '00000000-0000-0000-0000-000000000000';

/**
 * Resolve which branches a user may access inside one shop.
 *
 * Shop-wide roles short-circuit to `null` without extra queries. Everyone else is
 * mapped through `staff` (by auth user) then `staff_branches`.
 *
 * @param supabase Session-scoped Supabase client.
 * @param userId Authenticated auth.users id.
 * @param shopId Tenant shop id from the caller's profile; `null` yields an empty scope.
 * @param roles Roles already resolved for the caller.
 * @returns `null` for shop-wide access, otherwise the allowed branch ids.
 */
export async function resolveBranchScope(
  supabase: SupabaseClient,
  userId: string,
  shopId: string | null,
  roles: AppRole[]
): Promise<BranchScope> {
  if (roles.some((role) => SHOP_WIDE_ROLES.includes(role))) return null;
  if (!shopId) return [];

  const { data: staffRows, error: staffError } = await supabase
    .from('staff')
    .select('id')
    .eq('user_id', userId)
    .eq('shop_id', shopId)
    .eq('is_deleted', false);

  if (staffError) throw new AuthError('Unable to read branch assignments', 403);

  const staffIds = (staffRows ?? []).map((row) => row.id as string);
  if (staffIds.length === 0) return [];

  const { data: branchRows, error: branchError } = await supabase
    .from('staff_branches')
    .select('branch_id')
    .eq('shop_id', shopId)
    .eq('is_deleted', false)
    .in('staff_id', staffIds);

  if (branchError) throw new AuthError('Unable to read branch assignments', 403);

  const branchIds = (branchRows ?? [])
    .map((row) => row.branch_id as string | null)
    .filter((id): id is string => Boolean(id));

  return Array.from(new Set(branchIds));
}

/** True when the caller may read/write rows of this branch. */
export function isBranchAllowed(scope: BranchScope, branchId: string): boolean {
  return scope === null || scope.includes(branchId);
}

/**
 * Guard a client-supplied branch id before it reaches a query or an insert payload.
 *
 * @throws AuthError 403 when the branch is outside the caller's scope.
 */
export function assertBranchAllowed(scope: BranchScope, branchId: string): void {
  if (!isBranchAllowed(scope, branchId)) {
    throw new AuthError('Forbidden (branch out of scope)', 403);
  }
}

/**
 * Keep only the branch ids the caller may touch. Used when a payload carries a list
 * (e.g. assigning branches to a staff member).
 *
 * @throws AuthError 403 when any id is outside the caller's scope.
 */
export function assertBranchesAllowed(scope: BranchScope, branchIds: string[]): void {
  branchIds.forEach((id) => assertBranchAllowed(scope, id));
}

/**
 * Guard a write whose `branch_id` may be null, where null means "applies to the whole
 * shop". Only shop-wide callers may create or edit such a row — a branch-bound user
 * must not write a record that affects branches they do not manage.
 *
 * @throws AuthError 403 when the caller is branch-bound and the target is out of scope.
 */
export function assertBranchWritable(scope: BranchScope, branchId: string | null | undefined): void {
  if (scope === null) return;
  if (!branchId) throw new AuthError('Forbidden (shop-wide record requires owner)', 403);
  assertBranchAllowed(scope, branchId);
}

/**
 * Apply branch scope to a query over a table whose `branch_id` is NOT NULL.
 *
 * @param query Supabase filter builder.
 * @param scope Caller's branch scope.
 * @param requested Optional `?branch_id=` the client asked to narrow to.
 * @throws AuthError 403 when `requested` is outside the caller's scope.
 */
export function applyBranchScope<Q>(
  query: Q,
  scope: BranchScope,
  requested?: string | null,
  column = 'branch_id'
): Q {
  const ops = query as unknown as BranchFilterOps;
  if (requested) {
    assertBranchAllowed(scope, requested);
    return ops.eq(column, requested) as Q;
  }
  if (scope === null) return query;
  // Empty scope must return nothing rather than everything.
  return ops.in(column, scope.length > 0 ? scope : [NO_BRANCH]) as Q;
}

/**
 * Same as {@link applyBranchScope} but for tables where `branch_id` is nullable and
 * a NULL means "applies to the whole shop" (holidays, notifications, signage…).
 * Shop-wide rows stay visible to branch-bound users.
 */
export function applyNullableBranchScope<Q>(
  query: Q,
  scope: BranchScope,
  requested?: string | null,
  column = 'branch_id'
): Q {
  const ops = query as unknown as BranchFilterOps;
  if (requested) {
    assertBranchAllowed(scope, requested);
    return ops.eq(column, requested) as Q;
  }
  if (scope === null) return query;
  if (scope.length === 0) return ops.is(column, null) as Q;
  return ops.or(`${column}.is.null,${column}.in.(${scope.join(',')})`) as Q;
}
