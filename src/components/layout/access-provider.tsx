'use client';

import { createContext, useContext } from 'react';
import type { MenuAccess, MenuKey } from '@/lib/auth/menu-registry';

const AccessContext = createContext<MenuAccess | null>(null);

/**
 * Menu access of the signed-in user, resolved once by the server layout so the
 * sidebar never flickers. Pages still gate themselves with `requirePageAccess`.
 */
export function AccessProvider({ value, children }: { value: MenuAccess; children: React.ReactNode }) {
  return <AccessContext.Provider value={value}>{children}</AccessContext.Provider>;
}

/** Read the portal's menu access; outside the portal frame everything is allowed (standalone screens). */
export function useMenuAccess(): MenuAccess & { can: (key: MenuKey) => boolean } {
  const ctx = useContext(AccessContext);
  const value: MenuAccess = ctx ?? { level: 'admin', menuKeys: [] };
  return { ...value, can: (key) => (ctx ? value.menuKeys.includes(key) : true) };
}
