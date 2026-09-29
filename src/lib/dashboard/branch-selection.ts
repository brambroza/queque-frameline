import { isBranchCountAllowed, narrowBranchScope, parseBranchIdsParam, type Capabilities } from '@/lib/auth/role-capabilities';

export type BranchSelection =
  | { ok: true; scope: string[] | null }
  | { ok: false; status: number; error: string; code: 'BRANCH_FORBIDDEN' | 'BRANCH_REQUIRED' };

/**
 * Branches a dashboard request runs over: the ones it asked for
 * (`?branch_ids=a,b` or `?branch_id=a`), checked against the caller's role.
 *
 * @param params Query string of the request.
 * @param caps Caller's capabilities from `requireAuthContext`.
 * @param totalBranches Branches the caller may see, to resolve "all".
 * @returns The scope to query with (`null` = every branch), or the error to answer with.
 */
export function resolveBranchSelection(params: URLSearchParams, caps: Capabilities, totalBranches: number): BranchSelection {
  let scope: string[] | null;
  try {
    scope = narrowBranchScope(caps.branchScope, parseBranchIdsParam(params.get('branch_ids'), params.get('branch_id')));
  } catch {
    return { ok: false, status: 403, error: 'ไม่มีสิทธิ์ดูสาขานี้', code: 'BRANCH_FORBIDDEN' };
  }
  if (!isBranchCountAllowed(caps, scope, totalBranches)) {
    return { ok: false, status: 400, error: 'สิทธิ์ของคุณดูได้ทีละสาขา กรุณาเลือกสาขา', code: 'BRANCH_REQUIRED' };
  }
  return { ok: true, scope };
}
