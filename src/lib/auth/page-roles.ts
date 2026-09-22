import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { AppRole } from '@/types/db';
import { isAppRole } from './context';
import { firstAllowedHref, resolveMenuAccess, type MenuAccess, type MenuKey } from './menu-registry';

export type PageAccess = { roles: AppRole[]; isAdmin: boolean; access: MenuAccess };

/**
 * Role tiers + menu access of the signed-in user, for server components.
 * Hides admin actions and gates pages; every API route still enforces its own
 * roles. Redirects to /login when there is no session.
 */
export async function getPageRoles(): Promise<PageAccess> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data } = await supabase
    .from('user_roles')
    .select('roles(code,access_level,menu_keys,is_deleted)')
    .eq('user_id', user.id)
    .eq('is_deleted', false);
  const defs = (data ?? [])
    .map((r) => r.roles as { access_level?: string | null; menu_keys?: string[] | null; is_deleted?: boolean | null } | null)
    .filter((r): r is { access_level: string; menu_keys: string[] | null; is_deleted: boolean | null } => Boolean(r) && isAppRole(r?.access_level) && !r?.is_deleted)
    .map((r) => ({ access_level: r.access_level as AppRole, menu_keys: r.menu_keys }));
  const access = resolveMenuAccess(defs);
  const roles: AppRole[] = access.level === 'admin' ? ['admin', 'staff'] : defs.length ? ['staff'] : [];
  return { roles, isAdmin: access.level === 'admin', access };
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
