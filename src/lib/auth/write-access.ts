/**
 * API-side check of the per-menu "แก้ไขได้" switch (`roles.write_keys`).
 * The route guard still decides the level; this decides whether the caller's
 * roles allow the write actions of the page that owns the route.
 */
import { AuthError } from './errors';
import { canWriteMenu, type MenuKey } from './menu-registry';

/** Menus whose write switch lets a caller create or change queues (board, queue list, and the SO / PO pages for walk-in). */
export const QUEUE_WRITE_MENUS: MenuKey[] = ['dock_queues', 'queue_board', 'sales_orders', 'purchase_orders'];

/** 403 unless the caller may write on this menu. */
export function assertWriteMenu(caller: { writeKeys: readonly string[] }, key: MenuKey): void {
  if (!canWriteMenu(key, caller)) throw new AuthError(`Forbidden (no write access: ${key})`, 403);
}

/** 403 unless the caller may write on at least one of these menus. */
export function assertWriteAny(caller: { writeKeys: readonly string[] }, keys: readonly MenuKey[]): void {
  if (!keys.some((k) => canWriteMenu(k, caller))) throw new AuthError(`Forbidden (no write access: ${keys.join('|')})`, 403);
}
