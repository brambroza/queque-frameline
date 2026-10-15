/**
 * Who may key SO / PO into the portal, and where each document type lives.
 *
 * Writing a document type = the role's "แก้ไขได้" switch on that type's menu
 * (`roles.write_keys`, see menu-registry). Roles without an explicit list fall
 * back to the old defaults: admin level, or the department code that owns the
 * type (`sales_admin` for SO, `purchasing` for PO). An ordinary staff role with
 * the SO menu but no write switch can still record payments (a queue-side
 * action) without creating or cancelling documents.
 */
import type { PartnerType } from '@/types/db';
import { canWriteMenu, type MenuKey } from './menu-registry';

export type DocType = 'so' | 'po';

/** Role code that owns keying of each document type (besides admin level). */
export const DOCUMENT_ROLE: Record<DocType, string> = { so: 'sales_admin', po: 'purchasing' };

/** Portal menu that shows each document type. */
export const DOCUMENT_MENU: Record<DocType, MenuKey> = { so: 'sales_orders', po: 'purchase_orders' };

/** Portal path of each document type's page. */
export const DOCUMENT_PATH: Record<DocType, string> = { so: '/portal/sales-orders', po: '/portal/purchase-orders' };

/** Narrow an unknown value to a document type. */
export function isDocType(v: unknown): v is DocType {
  return v === 'so' || v === 'po';
}

/** Portal page for a document type (`/portal/sales-orders` for anything that is not a PO). */
export function documentPortalPath(docType: string | null | undefined): string {
  return docType === 'po' ? DOCUMENT_PATH.po : DOCUMENT_PATH.so;
}

/**
 * Whether the caller may create, edit, close, cancel, delete or issue booking
 * links for documents of this type: admin level, or the role that owns the type.
 */
export function canWriteDocument(docType: DocType, caller: { writeKeys: readonly string[] }): boolean {
  return canWriteMenu(DOCUMENT_MENU[docType], caller);
}

/**
 * Whether the caller may add, edit, unlink or delete partners: the "แก้ไขได้"
 * switch on the partners menu. Both tabs follow the same switch; the type
 * parameter is kept so pages can pass it per tab.
 */
export function canWritePartner(_partnerType: PartnerType, caller: { writeKeys: readonly string[] }): boolean {
  return canWriteMenu('partners', caller);
}
