import { describe, expect, it } from 'vitest';
import {
  MENU_KEYS, NO_ACCESS_PATH, firstAllowedHref, menuKeyForPath, menuKeysForLevel, menuKeysOfRole, resolveMenuAccess, validateRoleMenuKeys,
} from './menu-registry';

describe('menuKeysForLevel', () => {
  it('gives admin every menu and staff everything but admin-only pages', () => {
    expect(menuKeysForLevel('admin')).toEqual(MENU_KEYS);
    const staff = menuKeysForLevel('staff');
    expect(staff).not.toContain('reports');
    expect(staff).not.toContain('staff');
    expect(staff).not.toContain('line_settings');
    expect(staff).not.toContain('translations');
    expect(staff).toContain('dock_queues');
  });
});

describe('menuKeysOfRole', () => {
  it('null menu_keys = everything the level allows', () => {
    expect(menuKeysOfRole({ access_level: 'staff', menu_keys: null })).toEqual(menuKeysForLevel('staff'));
    expect(menuKeysOfRole({ access_level: 'admin', menu_keys: undefined })).toEqual(MENU_KEYS);
  });

  it('keeps sidebar order and drops unknown keys', () => {
    expect(menuKeysOfRole({ access_level: 'staff', menu_keys: ['queue_board', 'bogus', 'dashboard'] })).toEqual(['dashboard', 'queue_board']);
  });

  it('clamps a staff-level role to non-admin menus even when listed', () => {
    expect(menuKeysOfRole({ access_level: 'staff', menu_keys: ['reports', 'dock_queues'] })).toEqual(['dock_queues']);
  });

  it('an admin-level role always keeps the staff screen', () => {
    expect(menuKeysOfRole({ access_level: 'admin', menu_keys: ['dashboard'] })).toEqual(['dashboard', 'staff']);
  });
});

describe('resolveMenuAccess', () => {
  it('unions menus across roles and takes the highest level', () => {
    const access = resolveMenuAccess([
      { access_level: 'staff', menu_keys: ['queue_board'] },
      { access_level: 'staff', menu_keys: ['documents'] },
    ]);
    expect(access).toEqual({ level: 'staff', menuKeys: ['documents', 'queue_board'] });
    expect(resolveMenuAccess([{ access_level: 'staff', menu_keys: [] }, { access_level: 'admin', menu_keys: null }]).level).toBe('admin');
  });

  it('no roles = staff level with no menus', () => {
    expect(resolveMenuAccess([])).toEqual({ level: 'staff', menuKeys: [] });
  });
});

describe('menuKeyForPath / firstAllowedHref', () => {
  it('maps nested paths to their menu', () => {
    expect(menuKeyForPath('/portal/bookings')).toBe('dock_queues');
    expect(menuKeyForPath('/portal/bookings/abc')).toBe('dock_queues');
    expect(menuKeyForPath('/portal/nope')).toBeNull();
  });

  it('lands on the first allowed menu, else the no-access page', () => {
    expect(firstAllowedHref({ menuKeys: ['queue_board', 'dock_queues'] })).toBe('/portal/bookings');
    expect(firstAllowedHref({ menuKeys: [] })).toBe(NO_ACCESS_PATH);
  });
});

describe('validateRoleMenuKeys', () => {
  it('rejects unknown keys and admin-only keys on a staff role', () => {
    expect(validateRoleMenuKeys('staff', ['x']).ok).toBe(false);
    expect(validateRoleMenuKeys('staff', ['reports']).ok).toBe(false);
    expect(validateRoleMenuKeys('staff', 'no')).toEqual({ ok: false, error: 'menu_keys ต้องเป็นรายการ' });
  });

  it('accepts and orders a valid list', () => {
    expect(validateRoleMenuKeys('admin', ['reports', 'dashboard'])).toEqual({ ok: true, keys: ['dashboard', 'reports'] });
  });
});
