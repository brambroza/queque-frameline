import { describe, expect, it } from 'vitest';
import { canManageSite, effectiveLevels, highestLevel, isAppRole, isReadOnly } from './levels';

describe('isAppRole', () => {
  it('knows the four levels and nothing else', () => {
    for (const l of ['admin', 'manager', 'staff', 'viewer']) expect(isAppRole(l)).toBe(true);
    for (const l of ['super_admin', 'director', '', null, undefined, 1]) expect(isAppRole(l)).toBe(false);
  });
});

describe('highestLevel', () => {
  it('picks the top of the ladder, with viewer last', () => {
    expect(highestLevel(['staff', 'admin'])).toBe('admin');
    expect(highestLevel(['staff', 'manager'])).toBe('manager');
    expect(highestLevel(['viewer', 'staff'])).toBe('staff');
    expect(highestLevel(['viewer'])).toBe('viewer');
    expect(highestLevel([])).toBe('staff');
  });
});

describe('effectiveLevels', () => {
  it('lets a manager through every staff guard', () => {
    expect(effectiveLevels(['manager'])).toEqual(['manager', 'staff']);
  });
  it('gives admin, staff and viewer nothing extra', () => {
    expect(effectiveLevels(['admin'])).toEqual(['admin']);
    expect(effectiveLevels(['staff'])).toEqual(['staff']);
    expect(effectiveLevels(['viewer'])).toEqual(['viewer']);
    expect(effectiveLevels([])).toEqual([]);
  });
  it('never turns a viewer into staff', () => {
    expect(effectiveLevels(['viewer'])).not.toContain('staff');
    expect(effectiveLevels(['viewer', 'manager'])).toEqual(['manager', 'staff', 'viewer']);
  });
});

describe('canManageSite / isReadOnly', () => {
  it('opens the warehouse set-up to admin and manager only', () => {
    expect(canManageSite(['admin'])).toBe(true);
    expect(canManageSite(['manager', 'staff'])).toBe(true);
    expect(canManageSite(['staff'])).toBe(false);
    expect(canManageSite(['viewer'])).toBe(false);
  });
  it('is read-only only when every role held is a viewer role', () => {
    expect(isReadOnly(['viewer'])).toBe(true);
    expect(isReadOnly(['viewer', 'staff'])).toBe(false);
    expect(isReadOnly(['admin'])).toBe(false);
    expect(isReadOnly([])).toBe(false);
  });
});
