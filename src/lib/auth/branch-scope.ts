import { AuthError } from './errors';

/**
 * Branches the caller is allowed to see.
 * `null` means every branch of the site (admin-level roles, or a role without a
 * branch list). An empty array means the caller holds no role — they see nothing.
 * Resolved from the caller's roles in `role-capabilities.ts`.
 */
export type BranchScope = string[] | null;

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

/**
 * Guard one row a service-role query returned: RLS did not run, so the branch
 * check has to happen here. A null branch is a site-wide row and always passes.
 *
 * @throws AuthError 404 when the row's branch is outside the caller's scope — the
 *   same answer as a row that does not exist, so ids of other branches are not confirmed.
 */
export function assertRowBranch(scope: BranchScope, branchId: string | null | undefined): void {
  if (!branchId || isBranchAllowed(scope, branchId)) return;
  throw new AuthError('Not found', 404);
}
