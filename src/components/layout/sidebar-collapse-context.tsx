'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

/** Sidebar width (px) when expanded on desktop. */
export const SIDEBAR_WIDTH = 280;
/** Sidebar width (px) when collapsed to the icon rail on desktop. */
export const SIDEBAR_MINI_WIDTH = 76;

const STORAGE_KEY = 'portal.sidebar_collapsed';

type SidebarCollapseValue = {
  /** True when the desktop sidebar is collapsed to the icon rail. */
  collapsed: boolean;
  /** Flip between expanded and collapsed. */
  toggle: () => void;
  /** Set the collapsed state explicitly. */
  setCollapsed: (next: boolean) => void;
};

const SidebarCollapseContext = createContext<SidebarCollapseValue | null>(null);

/**
 * Read the persisted collapse preference. Returns null when storage is
 * unavailable (private mode) or nothing has been saved yet.
 */
function readStoredCollapsed(): boolean | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === '1') return true;
    if (raw === '0') return false;
    return null;
  } catch {
    return null;
  }
}

/**
 * Persist the collapse preference. Silently ignores storage failures.
 */
function writeStoredCollapsed(value: boolean) {
  try {
    window.localStorage.setItem(STORAGE_KEY, value ? '1' : '0');
  } catch {
    // Storage unavailable — preference simply will not persist.
  }
}

/**
 * Provides the desktop sidebar collapse state to the portal frame and nav.
 * The initial render is always "expanded" so SSR and the first client render
 * match; the stored preference is applied after hydration.
 */
export function SidebarCollapseProvider({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsedState] = useState(false);

  useEffect(() => {
    const stored = readStoredCollapsed();
    if (stored !== null) setCollapsedState(stored);
  }, []);

  const setCollapsed = useCallback((next: boolean) => {
    setCollapsedState(next);
    writeStoredCollapsed(next);
  }, []);

  const toggle = useCallback(() => {
    setCollapsedState((prev) => {
      const next = !prev;
      writeStoredCollapsed(next);
      return next;
    });
  }, []);

  const value = useMemo(() => ({ collapsed, toggle, setCollapsed }), [collapsed, toggle, setCollapsed]);

  return <SidebarCollapseContext.Provider value={value}>{children}</SidebarCollapseContext.Provider>;
}

/**
 * Access the sidebar collapse state. Must be used inside SidebarCollapseProvider.
 */
export function useSidebarCollapse(): SidebarCollapseValue {
  const ctx = useContext(SidebarCollapseContext);
  if (!ctx) throw new Error('useSidebarCollapse must be used within SidebarCollapseProvider');
  return ctx;
}
