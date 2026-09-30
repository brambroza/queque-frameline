/**
 * Portal menu registry + the pure rule that decides which menus a user sees.
 *
 * A role carries an access level (admin | manager | staff | viewer — the tier
 * every API route checks, see `levels.ts`) and an optional list of menu keys.
 * Null keys = every menu the level allows. A user's menus are the union over
 * all of their roles. A menu's `minLevel` is the lowest level whose API calls
 * the page needs, so a role below it can never be given the menu; a read-only
 * role may only be given menus marked `viewer`. Admin-level roles always keep
 * the staff screen so nobody can lock the site out of role management.
 */
import type { AppRole } from '@/types/db';
import { highestLevel } from './levels';

export type MenuKey =
  | 'dashboard' | 'dock_queues' | 'sales_orders' | 'purchase_orders' | 'calendar' | 'queue_board' | 'queue_display' | 'notifications'
  | 'branches' | 'vehicle_types' | 'docks' | 'working_hours' | 'holidays' | 'staff' | 'partners'
  | 'reports' | 'activity_logs' | 'site_settings' | 'line_settings' | 'api_keys' | 'settings' | 'translations';

export type MenuGroupKey = 'overview' | 'group_site' | 'group_insights';

export type MenuItemDef = {
  key: MenuKey;
  href: string;
  labelKey: string;
  fallback: string;
  group: MenuGroupKey;
  /** Lowest level that may be given this menu, because the page's API is closed below it. Omitted = staff. */
  minLevel?: 'manager' | 'admin';
  /** A read-only (viewer) role may be given this menu: the page works on GET calls alone. */
  viewer?: boolean;
};

export const MENU_GROUPS: Array<{ key: MenuGroupKey; titleKey: string; fallback: string }> = [
  { key: 'overview', titleKey: 'menu.overview', fallback: 'ภาพรวม' },
  { key: 'group_site', titleKey: 'menu.group_site', fallback: 'จัดการคลัง' },
  { key: 'group_insights', titleKey: 'menu.group_insights', fallback: 'รายงาน & ตั้งค่า' },
];

export const MENU_ITEMS: MenuItemDef[] = [
  { key: 'dashboard', href: '/portal/dashboard', labelKey: 'menu.dashboard', fallback: 'แดชบอร์ด', group: 'overview', viewer: true },
  { key: 'dock_queues', href: '/portal/bookings', labelKey: 'menu.dock_queues', fallback: 'คิวรับ-ส่งสินค้า', group: 'overview' },
  { key: 'sales_orders', href: '/portal/sales-orders', labelKey: 'menu.sales_orders', fallback: 'ใบสั่งขาย (SO)', group: 'overview' },
  { key: 'purchase_orders', href: '/portal/purchase-orders', labelKey: 'menu.purchase_orders', fallback: 'ใบสั่งซื้อ (PO)', group: 'overview' },
  { key: 'calendar', href: '/portal/calendar', labelKey: 'menu.calendar', fallback: 'ปฏิทิน', group: 'overview', viewer: true },
  { key: 'queue_board', href: '/portal/queue-board', labelKey: 'menu.queue_board', fallback: 'บอร์ดคิว', group: 'overview', viewer: true },
  { key: 'queue_display', href: '/portal/queue-display', labelKey: 'menu.queue_display', fallback: 'จอแสดงคิว', group: 'overview' },
  { key: 'notifications', href: '/portal/notifications', labelKey: 'menu.notifications', fallback: 'การแจ้งเตือน', group: 'overview' },
  { key: 'branches', href: '/portal/branches', labelKey: 'menu.branches', fallback: 'สาขา/ประตู', group: 'group_site' },
  { key: 'vehicle_types', href: '/portal/services', labelKey: 'menu.vehicle_types', fallback: 'ประเภทรถ', group: 'group_site' },
  { key: 'docks', href: '/portal/resources', labelKey: 'menu.docks', fallback: 'ท่ารับ-ส่งสินค้า', group: 'group_site' },
  { key: 'working_hours', href: '/portal/working-hours', labelKey: 'menu.working_hours', fallback: 'เวลาทำการ', group: 'group_site' },
  { key: 'holidays', href: '/portal/holidays', labelKey: 'menu.holidays', fallback: 'วันหยุด', group: 'group_site' },
  { key: 'staff', href: '/portal/staff', labelKey: 'menu.staff', fallback: 'พนักงาน', group: 'group_site', minLevel: 'admin' },
  { key: 'partners', href: '/portal/partners', labelKey: 'menu.partners', fallback: 'คู่ค้า', group: 'group_site' },
  { key: 'reports', href: '/portal/reports', labelKey: 'menu.reports', fallback: 'รายงาน', group: 'group_insights', minLevel: 'manager', viewer: true },
  { key: 'activity_logs', href: '/portal/activity-logs', labelKey: 'menu.activity_logs', fallback: 'ประวัติการใช้งาน', group: 'group_insights', minLevel: 'admin' },
  { key: 'site_settings', href: '/portal/site-settings', labelKey: 'menu.site_settings', fallback: 'ตั้งค่าระบบคิว', group: 'group_insights' },
  { key: 'line_settings', href: '/portal/line-settings', labelKey: 'menu.line_settings', fallback: 'เชื่อมต่อ LINE', group: 'group_insights', minLevel: 'admin' },
  { key: 'api_keys', href: '/portal/api-keys', labelKey: 'menu.api_keys', fallback: 'เชื่อมต่อ ERP', group: 'group_insights', minLevel: 'admin' },
  { key: 'settings', href: '/portal/settings', labelKey: 'menu.settings', fallback: 'ข้อมูลคลัง', group: 'group_insights' },
  { key: 'translations', href: '/portal/translations', labelKey: 'menu.translations', fallback: 'การแปลภาษา', group: 'group_insights', minLevel: 'admin' },
];

export const MENU_KEYS: MenuKey[] = MENU_ITEMS.map((m) => m.key);

/** Menu an admin-level role can never drop, so role management stays reachable. */
export const ADMIN_LOCKED_MENUS: MenuKey[] = ['staff'];

/** Where a user with no allowed menu at all lands. Not itself a menu. */
export const NO_ACCESS_PATH = '/portal/no-access';

/** Narrow an unknown value to a menu key. */
export function isMenuKey(v: unknown): v is MenuKey {
  return typeof v === 'string' && (MENU_KEYS as string[]).includes(v);
}

/** Whether a role of this level may be given the menu. */
function levelAllows(level: AppRole, item: MenuItemDef): boolean {
  if (level === 'admin') return true;
  if (level === 'viewer') return item.viewer === true;
  if (level === 'manager') return item.minLevel !== 'admin';
  return !item.minLevel;
}

/** Menu keys a role of this level may be given. */
export function menuKeysForLevel(level: AppRole): MenuKey[] {
  return MENU_ITEMS.filter((m) => levelAllows(level, m)).map((m) => m.key);
}

/**
 * Menus one role grants: its explicit list (or everything for its level),
 * clamped to what the level allows, plus the locked menus for admin-level roles.
 */
export function menuKeysOfRole(role: { access_level: AppRole; menu_keys: string[] | null | undefined }): MenuKey[] {
  const allowed = menuKeysForLevel(role.access_level);
  const base = role.menu_keys == null ? allowed : role.menu_keys.filter(isMenuKey).filter((k) => allowed.includes(k));
  const locked = role.access_level === 'admin' ? ADMIN_LOCKED_MENUS : [];
  return MENU_KEYS.filter((k) => base.includes(k) || locked.includes(k));
}

export type MenuAccess = { level: AppRole; menuKeys: MenuKey[] };

/** Effective access of a user holding these roles: highest level + union of menus. */
export function resolveMenuAccess(roles: Array<{ access_level: AppRole; menu_keys: string[] | null | undefined }>): MenuAccess {
  const level = highestLevel(roles.map((r) => r.access_level));
  const union = new Set<MenuKey>();
  roles.forEach((r) => menuKeysOfRole(r).forEach((k) => union.add(k)));
  return { level, menuKeys: MENU_KEYS.filter((k) => union.has(k)) };
}

/** Menu entry that owns a portal path (`/portal/bookings/abc` → the `dock_queues` item), or null. */
export function menuItemForPath(pathname: string): MenuItemDef | null {
  return MENU_ITEMS.find((m) => pathname === m.href || pathname.startsWith(`${m.href}/`)) ?? null;
}

/** Menu key that owns a portal path (`/portal/bookings/abc` → `dock_queues`), or null. */
export function menuKeyForPath(pathname: string): MenuKey | null {
  return menuItemForPath(pathname)?.key ?? null;
}

/** First menu the user may open, in sidebar order, or the no-access page. */
export function firstAllowedHref(access: Pick<MenuAccess, 'menuKeys'>): string {
  const first = MENU_ITEMS.find((m) => access.menuKeys.includes(m.key));
  return first?.href ?? NO_ACCESS_PATH;
}

/** Validate a menu list an admin submitted for a role of the given level. */
export function validateRoleMenuKeys(level: AppRole, keys: unknown): { ok: true; keys: MenuKey[] } | { ok: false; error: string } {
  if (!Array.isArray(keys)) return { ok: false, error: 'menu_keys ต้องเป็นรายการ' };
  const bad = keys.filter((k) => !isMenuKey(k));
  if (bad.length) return { ok: false, error: `ไม่รู้จักเมนู: ${bad.join(', ')}` };
  const allowed = menuKeysForLevel(level);
  const denied = (keys as MenuKey[]).filter((k) => !allowed.includes(k));
  if (denied.length) return { ok: false, error: `ระดับสิทธิ์นี้เปิดเมนูนี้ไม่ได้: ${denied.join(', ')}` };
  return { ok: true, keys: MENU_KEYS.filter((k) => (keys as MenuKey[]).includes(k)) };
}
