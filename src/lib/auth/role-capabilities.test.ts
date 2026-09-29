import { describe, expect, it } from 'vitest';
import { isBranchCountAllowed, narrowBranchScope, parseBranchIdsParam, resolveCapabilities, validateRoleBranchIds, type RoleAccessDef } from './role-capabilities';

const A = '11111111-1111-1111-1111-111111111111';
const B = '22222222-2222-2222-2222-222222222222';
const C = '33333333-3333-3333-3333-333333333333';

const role = (over: Partial<RoleAccessDef> = {}): RoleAccessDef => ({ access_level: 'staff', branch_ids: null, can_export: true, multi_branch: true, ...over });

describe('resolveCapabilities', () => {
  it('gives nothing to a user without roles', () => {
    expect(resolveCapabilities([])).toEqual({ branchScope: [], canExport: false, multiBranch: false });
  });

  it('never limits an admin-level role', () => {
    expect(resolveCapabilities([role({ access_level: 'admin', branch_ids: [A], can_export: false, multi_branch: false })])).toEqual({
      branchScope: null,
      canExport: true,
      multiBranch: true,
    });
  });

  it('limits a staff role to its branches and switches', () => {
    expect(resolveCapabilities([role({ branch_ids: [A], can_export: false, multi_branch: false })])).toEqual({
      branchScope: [A],
      canExport: false,
      multiBranch: false,
    });
  });

  it('unions branches and switches across roles', () => {
    const caps = resolveCapabilities([role({ branch_ids: [A], can_export: false, multi_branch: false }), role({ branch_ids: [B, A], can_export: true, multi_branch: false })]);
    expect(caps.branchScope?.sort()).toEqual([A, B]);
    expect(caps.canExport).toBe(true);
    expect(caps.multiBranch).toBe(false);
  });

  it('lifts the branch limit when any role is unlimited', () => {
    expect(resolveCapabilities([role({ branch_ids: [A] }), role({ branch_ids: null })]).branchScope).toBeNull();
  });

  it('reads missing columns as unlimited (migration not applied)', () => {
    expect(resolveCapabilities([{ access_level: 'staff', branch_ids: undefined, can_export: undefined, multi_branch: undefined }])).toEqual({
      branchScope: null,
      canExport: true,
      multiBranch: true,
    });
  });
});

describe('narrowBranchScope', () => {
  it('keeps the caller scope when nothing is requested', () => {
    expect(narrowBranchScope(null, [])).toBeNull();
    expect(narrowBranchScope([A], [])).toEqual([A]);
  });

  it('narrows to the requested branches', () => {
    expect(narrowBranchScope(null, [A, B, A])).toEqual([A, B]);
    expect(narrowBranchScope([A, B], [B])).toEqual([B]);
  });

  it('rejects a branch outside the scope', () => {
    expect(() => narrowBranchScope([A], [A, C])).toThrow(/out of scope/);
    try {
      narrowBranchScope([A], [C]);
    } catch (e) {
      expect((e as { status?: number }).status).toBe(403);
    }
  });

  it('rejects everything for an empty scope', () => {
    expect(() => narrowBranchScope([], [A])).toThrow();
  });
});

describe('isBranchCountAllowed', () => {
  it('lets multi-branch roles view anything', () => {
    expect(isBranchCountAllowed({ multiBranch: true }, null, 5)).toBe(true);
    expect(isBranchCountAllowed({ multiBranch: true }, [A, B], 5)).toBe(true);
  });

  it('holds single-branch roles to one branch', () => {
    expect(isBranchCountAllowed({ multiBranch: false }, [A], 5)).toBe(true);
    expect(isBranchCountAllowed({ multiBranch: false }, [A, B], 5)).toBe(false);
    expect(isBranchCountAllowed({ multiBranch: false }, null, 3)).toBe(false);
  });

  it('allows "all" on a one-branch site', () => {
    expect(isBranchCountAllowed({ multiBranch: false }, null, 1)).toBe(true);
  });
});

describe('parseBranchIdsParam', () => {
  it('merges the list and the single param without duplicates', () => {
    expect(parseBranchIdsParam(`${A}, ${B}`, A)).toEqual([A, B]);
    expect(parseBranchIdsParam(null, B)).toEqual([B]);
    expect(parseBranchIdsParam('', null)).toEqual([]);
  });
});

describe('validateRoleBranchIds', () => {
  it('accepts null as every branch', () => {
    expect(validateRoleBranchIds('staff', null, [A])).toEqual({ ok: true, branchIds: null });
  });

  it('drops the limit for admin-level roles', () => {
    expect(validateRoleBranchIds('admin', [A], [A])).toEqual({ ok: true, branchIds: null });
  });

  it('rejects an empty list and unknown branches', () => {
    expect(validateRoleBranchIds('staff', [], [A]).ok).toBe(false);
    expect(validateRoleBranchIds('staff', [C], [A, B]).ok).toBe(false);
    expect(validateRoleBranchIds('staff', 'x', [A]).ok).toBe(false);
  });

  it('deduplicates a valid list', () => {
    expect(validateRoleBranchIds('staff', [A, A, B], [A, B])).toEqual({ ok: true, branchIds: [A, B] });
  });
});
