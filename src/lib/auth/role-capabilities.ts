/**
 * What a user may see and do beyond menus, derived from the roles they hold:
 * which branches, whether they may export, and whether they may look at
 * several branches together on the dashboard.
 *
 * Pure: mirrored by `is_branch_bound()` / `can_access_branch()` in
 * `202609290001_role_branch_access.sql`, which enforce the branch part in RLS.
 */
import type { AppRole } from '@/types/db';

/** Columns of `roles` that carry capabilities. */
export type RoleAccessDef = {
  access_level: AppRole;
  /** null = every branch */
  branch_ids: string[] | null | undefined;
  can_export: boolean | null | undefined;
  multi_branch: boolean | null | undefined;
};

export type Capabilities = {
  /** `null` = every branch of the site; `[]` = none. */
  branchScope: string[] | null;
  canExport: boolean;
  multiBranch: boolean;
};

/** Columns to select alongside a role's level. */
export const ROLE_CAPABILITY_SELECT = 'branch_ids,can_export,multi_branch';

/**
 * Effective capabilities over every role the user holds (union).
 *
 * - An admin-level role is never limited: every branch, export, multi-branch.
 * - Any role without a branch list lifts the branch limit.
 * - Missing columns (migration not applied yet) read as "unlimited", which is
 *   how the portal behaved before capabilities existed.
 */
export function resolveCapabilities(roles: RoleAccessDef[]): Capabilities {
  if (roles.length === 0) return { branchScope: [], canExport: false, multiBranch: false };
  if (roles.some((r) => r.access_level === 'admin')) return { branchScope: null, canExport: true, multiBranch: true };

  const unlimited = roles.some((r) => r.branch_ids == null);
  const union = new Set<string>();
  roles.forEach((r) => (r.branch_ids ?? []).forEach((id) => union.add(id)));

  return {
    branchScope: unlimited ? null : Array.from(union),
    canExport: roles.some((r) => r.can_export !== false),
    multiBranch: roles.some((r) => r.multi_branch !== false),
  };
}

/**
 * Narrow the caller's scope to the branches a request asked for.
 *
 * @returns The scope to query with: the requested ids when given, else the caller's own scope.
 * @throws Error with `status` 403 when a requested branch is outside the caller's scope.
 */
export function narrowBranchScope(scope: string[] | null, requested: string[]): string[] | null {
  const ids = Array.from(new Set(requested.filter(Boolean)));
  if (ids.length === 0) return scope;
  const denied = scope === null ? [] : ids.filter((id) => !scope.includes(id));
  if (denied.length > 0) throw Object.assign(new Error('Forbidden (branch out of scope)'), { status: 403 });
  return ids;
}

/**
 * Whether the caller may run a view over this many branches.
 * Without `multiBranch`, a view must cover exactly one branch.
 *
 * @param effective Scope the query will run with (`null` = every branch).
 * @param totalBranches How many branches the site has, to resolve `null`.
 */
export function isBranchCountAllowed(caps: Pick<Capabilities, 'multiBranch'>, effective: string[] | null, totalBranches: number): boolean {
  if (caps.multiBranch) return true;
  const n = effective === null ? totalBranches : effective.length;
  return n <= 1;
}

/** Parse `?branch_ids=a,b` (and the older single `?branch_id=a`) into a list. */
export function parseBranchIdsParam(branchIds: string | null | undefined, branchId: string | null | undefined): string[] {
  const list = (branchIds ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  if (branchId) list.push(branchId);
  return Array.from(new Set(list));
}

/** Validate a role's branch list against the site's branches before saving. */
export function validateRoleBranchIds(
  level: AppRole,
  branchIds: unknown,
  siteBranchIds: string[],
): { ok: true; branchIds: string[] | null } | { ok: false; error: string } {
  if (branchIds == null) return { ok: true, branchIds: null };
  if (level === 'admin') return { ok: true, branchIds: null };
  if (!Array.isArray(branchIds) || branchIds.some((id) => typeof id !== 'string')) return { ok: false, error: 'branch_ids ต้องเป็นรายการ' };
  const ids = Array.from(new Set(branchIds as string[]));
  if (ids.length === 0) return { ok: false, error: 'เลือกอย่างน้อย 1 สาขา หรือเปิด "เห็นทุกสาขา"' };
  const unknown = ids.filter((id) => !siteBranchIds.includes(id));
  if (unknown.length) return { ok: false, error: 'มีสาขาที่ไม่อยู่ในระบบ' };
  return { ok: true, branchIds: ids };
}
