/**
 * Access levels (`roles.access_level`) — the tier every API route checks.
 *
 *   admin    runs the site: staff, roles, branches, LINE, ERP keys, everything below
 *   manager  warehouse manager: everything staff does + reports and the warehouse
 *            set-up (docks, vehicle types, working hours, holidays, partners, queue settings)
 *   staff    gate and dock work: queues, check-in, calls, payments
 *   viewer   read-only: sees the pages it is given, can change nothing
 *
 * `admin > manager > staff` is a ladder. `viewer` is not on it: a route lets a
 * viewer in only by naming `'viewer'` in its guard, so every route that writes
 * is closed to it by default.
 *
 * Pure: shared by the API guard, the page guard and the role forms.
 */
import type { AppRole } from '@/types/db';

/** Every level, highest first. */
export const APP_ROLES: readonly AppRole[] = ['admin', 'manager', 'staff', 'viewer'];

/** Narrow a `roles.access_level` value to the app's levels. */
export function isAppRole(v: unknown): v is AppRole {
  return typeof v === 'string' && (APP_ROLES as readonly string[]).includes(v);
}

/** Thai label of each level, for the role and staff screens. */
export const LEVEL_LABEL: Record<AppRole, string> = {
  admin: 'ผู้ดูแลระบบ',
  manager: 'ผู้จัดการ',
  staff: 'พนักงาน',
  viewer: 'ดูอย่างเดียว',
};

/**
 * The level a user acts at when holding several roles: the highest one.
 * No role at all reads as `staff` with nothing granted (callers check the menus).
 */
export function highestLevel(levels: readonly AppRole[]): AppRole {
  return APP_ROLES.find((l) => levels.includes(l)) ?? 'staff';
}

/**
 * Levels a route guard should see for a user holding `levels`.
 * A manager also counts as staff, so the many `['admin', 'staff']` guards need
 * no change; a viewer counts as nothing else.
 */
export function effectiveLevels(levels: readonly AppRole[]): AppRole[] {
  const out = new Set<AppRole>(levels);
  if (out.has('manager')) out.add('staff');
  return APP_ROLES.filter((l) => out.has(l));
}

/** May edit the warehouse set-up and open the reports: admin or manager. */
export function canManageSite(levels: readonly AppRole[]): boolean {
  return levels.includes('admin') || levels.includes('manager');
}

/** Holds roles, and every one of them is read-only. */
export function isReadOnly(levels: readonly AppRole[]): boolean {
  return levels.length > 0 && levels.every((l) => l === 'viewer');
}
