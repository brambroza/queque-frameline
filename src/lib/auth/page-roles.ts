import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { AppRole } from '@/types/db';
import { canManageSite, effectiveLevels, isAppRole, isReadOnly } from './levels';
import { canWriteMenu, firstAllowedHref, resolveMenuAccess, type MenuAccess, type MenuKey } from './menu-registry';

export type PageAccess = {
  /** Levels the API guard would see (a manager also counts as staff). */
  roles: AppRole[];
  roleCodes: string[];
  isAdmin: boolean;
  /** Admin or manager: may edit the warehouse set-up (docks, vehicle types, partners, queue settings). */
  canManage: boolean;
  /** Every role held is read-only: hide every control that writes. */
  readOnly: boolean;
  /** Menus whose write actions the user may use ("แก้ไขได้" per menu, union over roles). */
  writeKeys: MenuKey[];
  /** Whether the page that owns `key` should show its write actions. */
  canWrite: (key: MenuKey) => boolean;
  access: MenuAccess;
};

/**
 * Role tiers, role codes and menu access of the signed-in user, for server components.
 * Hides admin actions and gates pages; every API route still enforces its own
 * roles. Redirects to /login when there is no session.
 */
export async function getPageRoles(): Promise<PageAccess> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  type RoleCols = { code?: string | null; access_level?: string | null; menu_keys?: string[] | null; write_keys?: string[] | null; is_deleted?: boolean | null };
  // `write_keys` comes from 202610150003; before it is applied, read without it (level defaults apply).
  let rows: Array<{ roles: RoleCols | null }> | null = null;
  for (const sel of ['roles(code,access_level,menu_keys,write_keys,is_deleted)', 'roles(code,access_level,menu_keys,is_deleted)']) {
    const res = await supabase.from('user_roles').select(sel).eq('user_id', user.id).eq('is_deleted', false);
    if (!res.error) {
      rows = (res.data ?? []) as unknown as Array<{ roles: RoleCols | null }>;
      break;
    }
  }
  const live = (rows ?? [])
    .map((r) => r.roles)
    .filter((r): r is RoleCols & { access_level: AppRole } => Boolean(r) && isAppRole(r?.access_level) && !r?.is_deleted);
  const defs = live.map((r) => ({ access_level: r.access_level, menu_keys: r.menu_keys, write_keys: r.write_keys, code: r.code }));
  const roleCodes = live.map((r) => r.code).filter((c): c is string => Boolean(c));
  const access = resolveMenuAccess(defs);
  const levels = defs.map((r) => r.access_level);
  const roles = effectiveLevels(levels);
  const writeKeys = access.writeKeys;
  return {
    roles,
    roleCodes,
    isAdmin: access.level === 'admin',
    canManage: canManageSite(levels),
    readOnly: isReadOnly(levels),
    writeKeys,
    canWrite: (key) => canWriteMenu(key, { writeKeys }),
    access,
  };
}

/**
 * Gate a portal page behind one menu key. A user whose roles do not include the
 * menu is sent to the first menu they may open (or the no-access page).
 */
export async function requirePageAccess(menu: MenuKey): Promise<PageAccess> {
  const page = await getPageRoles();
  if (!page.access.menuKeys.includes(menu)) redirect(firstAllowedHref(page.access));
  return page;
}
