/**
 * Who may key SO / PO into the portal, and where each document type lives.
 *
 * Sales orders are keyed by the sales admin, purchase orders by purchasing; the
 * warehouse (admin level) may do both. The two roles are seeded as staff-level
 * system roles (`sales_admin`, `purchasing`) and matched by role code, so an
 * ordinary staff role with the SO menu can still record payments without being
 * able to create or cancel documents.
 */
import type { AppRole } from '@/types/db';
import type { MenuKey } from './menu-registry';

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
export function canWriteDocument(docType: DocType, caller: { roles: readonly AppRole[]; roleCodes: readonly string[] }): boolean {
  if (caller.roles.includes('admin')) return true;
  return caller.roleCodes.includes(DOCUMENT_ROLE[docType]);
}
