import { describe, expect, it } from 'vitest';
import {
  MENU_KEYS, NO_ACCESS_PATH, WRITABLE_MENUS, canWriteMenu, firstAllowedHref, legacyWriteKeys, menuItemForPath, menuKeyForPath, menuKeysForLevel, menuKeysOfRole,
  resolveMenuAccess, resolveWriteKeys, validateRoleMenuKeys, validateRoleWriteKeys, writeKeysForLevel, writeKeysOfRole,
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

  it('gives a manager the reports on top of staff menus, but no admin screens', () => {
    const manager = menuKeysForLevel('manager');
    expect(manager).toEqual(expect.arrayContaining([...menuKeysForLevel('staff'), 'reports']));
    for (const k of ['staff', 'activity_logs', 'line_settings', 'api_keys', 'translations']) expect(manager).not.toContain(k);
  });

  it('gives a viewer only the pages that work without writing', () => {
    expect(menuKeysForLevel('viewer')).toEqual(['dashboard', 'calendar', 'queue_board', 'reports']);
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

  it('clamps a viewer role to read-only pages and a manager role below admin screens', () => {
    expect(menuKeysOfRole({ access_level: 'viewer', menu_keys: ['dashboard', 'dock_queues', 'reports'] })).toEqual(['dashboard', 'reports']);
    expect(menuKeysOfRole({ access_level: 'viewer', menu_keys: null })).toEqual(['dashboard', 'calendar', 'queue_board', 'reports']);
    expect(menuKeysOfRole({ access_level: 'manager', menu_keys: ['reports', 'staff', 'docks'] })).toEqual(['docks', 'reports']);
  });

  it('an admin-level role always keeps the staff screen', () => {
    expect(menuKeysOfRole({ access_level: 'admin', menu_keys: ['dashboard'] })).toEqual(['dashboard', 'staff']);
  });
});

describe('resolveMenuAccess', () => {
  it('unions menus across roles and takes the highest level', () => {
    const access = resolveMenuAccess([
      { access_level: 'staff', menu_keys: ['queue_board'] },
      { access_level: 'staff', menu_keys: ['sales_orders'] },
    ]);
    expect(access).toEqual({ level: 'staff', menuKeys: ['sales_orders', 'queue_board'], writeKeys: ['queue_board'] });
    expect(resolveMenuAccess([{ access_level: 'staff', menu_keys: [] }, { access_level: 'admin', menu_keys: null }]).level).toBe('admin');
    expect(resolveMenuAccess([{ access_level: 'staff', menu_keys: [] }, { access_level: 'manager', menu_keys: ['reports'] }])).toEqual({ level: 'manager', menuKeys: ['reports'], writeKeys: [] });
    expect(resolveMenuAccess([{ access_level: 'viewer', menu_keys: null }]).level).toBe('viewer');
    // A viewer role next to a working role does not make the user read-only.
    expect(resolveMenuAccess([{ access_level: 'viewer', menu_keys: null }, { access_level: 'staff', menu_keys: ['dock_queues'] }]).level).toBe('staff');
  });

  it('no roles = staff level with no menus', () => {
    expect(resolveMenuAccess([])).toEqual({ level: 'staff', menuKeys: [], writeKeys: [] });
  });
});

describe('menuKeyForPath / firstAllowedHref', () => {
  it('maps nested paths to their menu', () => {
    expect(menuKeyForPath('/portal/bookings')).toBe('dock_queues');
    expect(menuKeyForPath('/portal/bookings/abc')).toBe('dock_queues');
    expect(menuKeyForPath('/portal/nope')).toBeNull();
  });

  it('returns the whole menu entry for a path so callers can label it', () => {
    expect(menuItemForPath('/portal/bookings/abc')?.fallback).toBe('คิวรับ-ส่งสินค้า');
    expect(menuItemForPath('/portal/bookingsx')).toBeNull();
    expect(menuItemForPath('/portal')).toBeNull();
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

  it('holds manager and viewer roles to their own menus', () => {
    expect(validateRoleMenuKeys('manager', ['reports', 'docks']).ok).toBe(true);
    expect(validateRoleMenuKeys('manager', ['staff']).ok).toBe(false);
    expect(validateRoleMenuKeys('viewer', ['dashboard', 'reports']).ok).toBe(true);
    expect(validateRoleMenuKeys('viewer', ['dock_queues']).ok).toBe(false);
  });

  it('accepts and orders a valid list', () => {
    expect(validateRoleMenuKeys('admin', ['reports', 'dashboard'])).toEqual({ ok: true, keys: ['dashboard', 'reports'] });
  });
});

describe('writeKeysForLevel / legacyWriteKeys', () => {
  it('viewer writes nowhere, staff / manager everywhere but admin-only screens, admin everywhere', () => {
    expect(writeKeysForLevel('viewer')).toEqual([]);
    expect(writeKeysForLevel('staff')).not.toContain('staff');
    expect(writeKeysForLevel('staff')).toContain('docks');
    expect(writeKeysForLevel('admin')).toEqual(WRITABLE_MENUS);
  });

  it('level defaults match the behaviour before the switch existed', () => {
    expect(legacyWriteKeys({ access_level: 'staff', code: 'wh_admin' })).toEqual(['dock_queues', 'queue_board']);
    expect(legacyWriteKeys({ access_level: 'staff', code: 'sales_admin' })).toEqual(['dock_queues', 'sales_orders', 'queue_board', 'partners']);
    expect(legacyWriteKeys({ access_level: 'manager', code: 'wh_manager' })).toContain('docks');
    expect(legacyWriteKeys({ access_level: 'manager', code: 'wh_manager' })).not.toContain('sales_orders');
    expect(legacyWriteKeys({ access_level: 'viewer', code: 'director' })).toEqual([]);
  });
});

describe('writeKeysOfRole / resolveWriteKeys', () => {
  it('null write_keys = level defaults inside the visible menus', () => {
    expect(writeKeysOfRole({ access_level: 'staff', code: 'wh_admin', menu_keys: ['dock_queues', 'calendar'], write_keys: null })).toEqual(['dock_queues']);
    expect(writeKeysOfRole({ access_level: 'staff', code: 'sales_admin', menu_keys: ['sales_orders', 'partners'], write_keys: null })).toEqual(['sales_orders', 'partners']);
  });

  it('an explicit list is clamped to visible menus and to what the level may write', () => {
    expect(writeKeysOfRole({ access_level: 'staff', code: 'x', menu_keys: ['sales_orders', 'docks'], write_keys: ['sales_orders', 'docks', 'staff', 'purchase_orders'] })).toEqual(['sales_orders', 'docks']);
    expect(writeKeysOfRole({ access_level: 'staff', code: 'x', menu_keys: ['sales_orders'], write_keys: [] })).toEqual([]);
  });

  it('admin writes on every menu it sees; viewer never', () => {
    expect(writeKeysOfRole({ access_level: 'admin', code: 'admin', menu_keys: null, write_keys: [] })).toEqual(WRITABLE_MENUS);
    expect(writeKeysOfRole({ access_level: 'viewer', code: 'director', menu_keys: null, write_keys: ['dashboard', 'queue_board'] })).toEqual([]);
  });

  it('unions across roles and feeds canWriteMenu', () => {
    const keys = resolveWriteKeys([
      { access_level: 'staff', code: 'a', menu_keys: ['sales_orders'], write_keys: ['sales_orders'] },
      { access_level: 'staff', code: 'b', menu_keys: ['partners'], write_keys: ['partners'] },
    ]);
    expect(keys).toEqual(['sales_orders', 'partners']);
    expect(canWriteMenu('partners', { writeKeys: keys })).toBe(true);
    expect(canWriteMenu('docks', { writeKeys: keys })).toBe(false);
    expect(resolveMenuAccess([{ access_level: 'staff', code: 'a', menu_keys: ['sales_orders'], write_keys: ['sales_orders'] }]).writeKeys).toEqual(['sales_orders']);
  });
});

describe('validateRoleWriteKeys', () => {
  it('rejects unknown keys, non-writable menus and admin-only writes on a staff role', () => {
    expect(validateRoleWriteKeys('staff', 'x').ok).toBe(false);
    expect(validateRoleWriteKeys('staff', ['nope']).ok).toBe(false);
    expect(validateRoleWriteKeys('staff', ['dashboard']).ok).toBe(false);
    expect(validateRoleWriteKeys('staff', ['staff']).ok).toBe(false);
    expect(validateRoleWriteKeys('viewer', ['dock_queues']).ok).toBe(false);
  });

  it('accepts and orders a valid list', () => {
    expect(validateRoleWriteKeys('staff', ['partners', 'dock_queues'])).toEqual({ ok: true, keys: ['dock_queues', 'partners'] });
    expect(validateRoleWriteKeys('admin', ['staff'])).toEqual({ ok: true, keys: ['staff'] });
  });
});
