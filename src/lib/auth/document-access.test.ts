import { describe, expect, it } from 'vitest';
import { DOCUMENT_MENU, DOCUMENT_PATH, canWriteDocument, canWritePartner, documentPortalPath, isDocType } from './document-access';
import { MENU_KEYS, resolveMenuAccess } from './menu-registry';

/** Caller as the API / page sees it: the resolved "แก้ไขได้" list. */
const caller = (writeKeys: string[]) => ({ writeKeys });
/** Caller resolved from role rows, the way requireAuthContext builds it. */
const fromRoles = (...roles: Array<{ access_level: 'admin' | 'manager' | 'staff' | 'viewer'; code: string; menu_keys?: string[] | null; write_keys?: string[] | null }>) =>
  caller(resolveMenuAccess(roles.map((r) => ({ menu_keys: null, write_keys: null, ...r }))).writeKeys);

describe('canWriteDocument', () => {
  it('follows the write switch of the document menu', () => {
    expect(canWriteDocument('so', caller(['sales_orders']))).toBe(true);
    expect(canWriteDocument('po', caller(['sales_orders']))).toBe(false);
    expect(canWriteDocument('po', caller(['purchase_orders', 'partners']))).toBe(true);
    expect(canWriteDocument('so', caller([]))).toBe(false);
  });

  it('legacy roles (no write_keys): admin writes both, sales SO only, purchasing PO only, plain staff neither', () => {
    expect(canWriteDocument('so', fromRoles({ access_level: 'admin', code: 'admin' }))).toBe(true);
    expect(canWriteDocument('po', fromRoles({ access_level: 'admin', code: 'admin' }))).toBe(true);
    expect(canWriteDocument('so', fromRoles({ access_level: 'staff', code: 'sales_admin', menu_keys: ['sales_orders'] }))).toBe(true);
    expect(canWriteDocument('po', fromRoles({ access_level: 'staff', code: 'sales_admin', menu_keys: ['sales_orders'] }))).toBe(false);
    expect(canWriteDocument('po', fromRoles({ access_level: 'staff', code: 'purchasing', menu_keys: ['purchase_orders'] }))).toBe(true);
    expect(canWriteDocument('so', fromRoles({ access_level: 'staff', code: 'wh_admin', menu_keys: ['sales_orders', 'dock_queues'] }))).toBe(false);
    expect(canWriteDocument('so', fromRoles())).toBe(false);
  });

  it('a custom role gets SO buttons once its write switch is on', () => {
    expect(canWriteDocument('so', fromRoles({ access_level: 'staff', code: 'sales2', menu_keys: ['sales_orders'], write_keys: ['sales_orders'] }))).toBe(true);
    expect(canWriteDocument('so', fromRoles({ access_level: 'staff', code: 'sales2', menu_keys: ['sales_orders'], write_keys: [] }))).toBe(false);
    // The switch never reaches a menu the role does not see.
    expect(canWriteDocument('po', fromRoles({ access_level: 'staff', code: 'sales2', menu_keys: ['sales_orders'], write_keys: ['purchase_orders'] }))).toBe(false);
  });

  it('unions over several roles', () => {
    const both = fromRoles(
      { access_level: 'staff', code: 'sales_admin', menu_keys: ['sales_orders'] },
      { access_level: 'staff', code: 'purchasing', menu_keys: ['purchase_orders'] },
    );
    expect(canWriteDocument('so', both)).toBe(true);
    expect(canWriteDocument('po', both)).toBe(true);
  });
});

describe('document pages', () => {
  it('maps each type to a registered menu', () => {
    expect(MENU_KEYS).toContain(DOCUMENT_MENU.so);
    expect(MENU_KEYS).toContain(DOCUMENT_MENU.po);
  });

  it('resolves the portal path, falling back to SO for unknown types', () => {
    expect(documentPortalPath('po')).toBe(DOCUMENT_PATH.po);
    expect(documentPortalPath('so')).toBe(DOCUMENT_PATH.so);
    expect(documentPortalPath(null)).toBe(DOCUMENT_PATH.so);
  });

  it('narrows doc types', () => {
    expect(isDocType('so')).toBe(true);
    expect(isDocType('po')).toBe(true);
    expect(isDocType('do')).toBe(false);
  });
});

describe('canWritePartner', () => {
  it('follows the write switch of the partners menu for both tabs', () => {
    expect(canWritePartner('customer', caller(['partners']))).toBe(true);
    expect(canWritePartner('supplier', caller(['partners']))).toBe(true);
    expect(canWritePartner('customer', caller(['sales_orders']))).toBe(false);
  });

  it('legacy roles: admin and manager write, sales / purchasing write, plain staff and viewers read', () => {
    expect(canWritePartner('customer', fromRoles({ access_level: 'admin', code: 'admin' }))).toBe(true);
    expect(canWritePartner('supplier', fromRoles({ access_level: 'manager', code: 'wh_manager' }))).toBe(true);
    expect(canWritePartner('customer', fromRoles({ access_level: 'staff', code: 'sales_admin', menu_keys: ['sales_orders', 'partners'] }))).toBe(true);
    expect(canWritePartner('supplier', fromRoles({ access_level: 'staff', code: 'purchasing', menu_keys: ['purchase_orders', 'partners'] }))).toBe(true);
    expect(canWritePartner('customer', fromRoles({ access_level: 'staff', code: 'wh_admin', menu_keys: ['partners'] }))).toBe(false);
    expect(canWritePartner('customer', fromRoles({ access_level: 'viewer', code: 'director', write_keys: ['partners'] }))).toBe(false);
  });
});
