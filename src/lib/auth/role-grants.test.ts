import { describe, expect, it } from 'vitest';
import { planRoleGrant } from './role-grants';

describe('planRoleGrant', () => {
  it('inserts when the user never held the role', () => {
    expect(planRoleGrant([], 'r1')).toEqual({ staleIds: [], reviveId: null, insert: true });
  });

  it('does nothing when the role is already active', () => {
    expect(planRoleGrant([{ id: 'g1', role_id: 'r1', is_deleted: false }], 'r1')).toEqual({ staleIds: [], reviveId: null, insert: false });
  });

  it('revives a soft-deleted grant instead of inserting a duplicate (staff removed and added back)', () => {
    expect(planRoleGrant([{ id: 'g1', role_id: 'r1', is_deleted: true }], 'r1')).toEqual({ staleIds: [], reviveId: 'g1', insert: false });
  });

  it('retires other active roles and revives the old one (A → B → A)', () => {
    const rows = [
      { id: 'gA', role_id: 'rA', is_deleted: true },
      { id: 'gB', role_id: 'rB', is_deleted: false },
    ];
    expect(planRoleGrant(rows, 'rA')).toEqual({ staleIds: ['gB'], reviveId: 'gA', insert: false });
  });

  it('leaves deleted grants of other roles alone', () => {
    const rows = [
      { id: 'gA', role_id: 'rA', is_deleted: true },
      { id: 'gB', role_id: 'rB', is_deleted: false },
    ];
    expect(planRoleGrant(rows, 'rC')).toEqual({ staleIds: ['gB'], reviveId: null, insert: true });
  });
});
