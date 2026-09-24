import { describe, expect, it } from 'vitest';
import { DOCUMENT_MENU, DOCUMENT_PATH, canWriteDocument, documentPortalPath, isDocType } from './document-access';
import { MENU_KEYS } from './menu-registry';

describe('canWriteDocument', () => {
  it('lets admin level write both types regardless of role code', () => {
    const admin = { roles: ['admin', 'staff'] as const, roleCodes: ['admin'] };
    expect(canWriteDocument('so', admin)).toBe(true);
    expect(canWriteDocument('po', admin)).toBe(true);
  });

  it('lets the sales admin key SO but not PO', () => {
    const sales = { roles: ['staff'] as const, roleCodes: ['sales_admin'] };
    expect(canWriteDocument('so', sales)).toBe(true);
    expect(canWriteDocument('po', sales)).toBe(false);
  });

  it('lets purchasing key PO but not SO', () => {
    const buyer = { roles: ['staff'] as const, roleCodes: ['purchasing'] };
    expect(canWriteDocument('po', buyer)).toBe(true);
    expect(canWriteDocument('so', buyer)).toBe(false);
  });

  it('refuses plain warehouse staff and users without roles', () => {
    expect(canWriteDocument('so', { roles: ['staff'], roleCodes: ['staff'] })).toBe(false);
    expect(canWriteDocument('po', { roles: [], roleCodes: [] })).toBe(false);
  });

  it('accepts a user holding both roles', () => {
    const both = { roles: ['staff'] as const, roleCodes: ['sales_admin', 'purchasing'] };
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
