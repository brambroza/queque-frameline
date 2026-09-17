'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export type BranchOption = { id: string; branch_name: string; active?: boolean };

type BranchScopeValue = {
  loading: boolean;
  /** 'shop' = may view every branch and pick "all branches"; 'branch' = bound to `branches`. */
  scope: 'shop' | 'branch';
  /** Branches the signed-in user may act on. */
  branches: BranchOption[];
  /** Currently selected branch; '' means "all branches I can see". */
  branchId: string;
  setBranchId: (id: string) => void;
  /** Copy of `params` with `branch_id` set when a single branch is selected. */
  withBranch: (params?: URLSearchParams) => URLSearchParams;
  /** `?branch_id=…` (or '') ready to append to a fetch URL that already has a query. */
  branchQuery: string;
};

const STORAGE_KEY = 'portal.branch_id';

const BranchScopeContext = createContext<BranchScopeValue | null>(null);

/**
 * Portal-wide branch selection.
 *
 * The API narrows every response to the caller's branches on its own; this only
 * decides which of those branches the user is currently looking at.
 */
export function BranchScopeProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [scope, setScope] = useState<'shop' | 'branch'>('shop');
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [branchId, setBranchIdState] = useState('');

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch('/api/me-branches', { cache: 'no-store' });
        const json = await res.json();
        if (cancelled || !res.ok) return;

        const list = (json.data?.branches ?? []) as BranchOption[];
        const nextScope = (json.data?.scope ?? 'shop') as 'shop' | 'branch';
        setBranches(list);
        setScope(nextScope);

        // URL wins over the remembered value so a shared link opens on the right branch.
        const fromUrl = new URLSearchParams(window.location.search).get('branch_id') ?? '';
        let stored = '';
        try {
          stored = window.localStorage.getItem(STORAGE_KEY) ?? '';
        } catch {
          stored = '';
        }
        const desired = fromUrl || stored;
        const valid = list.some((b) => b.id === desired) ? desired : '';

        // A user bound to exactly one branch has nothing to choose.
        setBranchIdState(nextScope === 'branch' && list.length === 1 ? list[0].id : valid);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const setBranchId = useCallback((id: string) => {
    setBranchIdState(id);
    try {
      if (id) window.localStorage.setItem(STORAGE_KEY, id);
      else window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Private mode or blocked storage — selection still applies for this session.
    }
    // Reflect the choice in the address bar without a Next.js navigation.
    const url = new URL(window.location.href);
    if (id) url.searchParams.set('branch_id', id);
    else url.searchParams.delete('branch_id');
    window.history.replaceState(null, '', url.toString());
  }, []);

  const withBranch = useCallback(
    (params?: URLSearchParams) => {
      const next = new URLSearchParams(params ?? undefined);
      if (branchId) next.set('branch_id', branchId);
      else next.delete('branch_id');
      return next;
    },
    [branchId]
  );

  const value = useMemo<BranchScopeValue>(
    () => ({
      loading,
      scope,
      branches,
      branchId,
      setBranchId,
      withBranch,
      branchQuery: branchId ? `branch_id=${encodeURIComponent(branchId)}` : '',
    }),
    [loading, scope, branches, branchId, setBranchId, withBranch]
  );

  return <BranchScopeContext.Provider value={value}>{children}</BranchScopeContext.Provider>;
}

/**
 * Read the portal's current branch selection.
 *
 * @returns The branch scope context, or a shop-wide no-op default when used outside
 *   the portal frame so standalone screens keep rendering.
 */
export function useBranchScope(): BranchScopeValue {
  const ctx = useContext(BranchScopeContext);
  if (ctx) return ctx;
  return {
    loading: false,
    scope: 'shop',
    branches: [],
    branchId: '',
    setBranchId: () => {},
    withBranch: (params?: URLSearchParams) => new URLSearchParams(params ?? undefined),
    branchQuery: '',
  };
}
