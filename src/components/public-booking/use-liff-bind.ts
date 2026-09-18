'use client';

import { useCallback, useEffect, useState } from 'react';

type Liff = {
  init: (cfg: { liffId: string; withLoginOnExternalBrowser?: boolean }) => Promise<void>;
  isLoggedIn: () => boolean;
  isInClient: () => boolean;
  login: (opts?: { redirectUri?: string }) => void;
  getIDToken: () => string | null;
  getFriendship: () => Promise<{ friendFlag: boolean }>;
  shareTargetPicker?: (messages: object[]) => Promise<unknown>;
  isApiAvailable?: (api: string) => boolean;
};

declare global {
  interface Window { liff?: Liff }
}

const SDK = 'https://static.line-scdn.net/liff/edge/2/sdk.js';

function loadSdk(): Promise<Liff> {
  return new Promise((resolve, reject) => {
    if (window.liff) return resolve(window.liff);
    const s = document.createElement('script');
    s.src = SDK;
    s.async = true;
    s.onload = () => (window.liff ? resolve(window.liff) : reject(new Error('liff missing')));
    s.onerror = () => reject(new Error('liff load failed'));
    document.head.appendChild(s);
  });
}

export type LiffBindState =
  | { phase: 'idle' }
  | { phase: 'binding' }
  | { phase: 'bound'; displayName: string | null; isFriend: boolean | null }
  | { phase: 'error'; message: string };

/**
 * When the page was opened through LIFF (`?via=line`), initialise the SDK,
 * make sure the user is logged in, and hand the ID token to `bindUrl` so the
 * server can attach the LINE user. Never blocks the page: on any failure the
 * page behaves like a normal web visit.
 *
 * @param liffId LIFF app id from the page's meta (null = LINE not configured).
 * @param bindUrl POST endpoint that accepts `{ id_token }`.
 */
export function useLiffBind(liffId: string | null | undefined, bindUrl: string): { state: LiffBindState; viaLine: boolean; liff: Liff | null } {
  const [state, setState] = useState<LiffBindState>({ phase: 'idle' });
  const [liff, setLiff] = useState<Liff | null>(null);
  const viaLine = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('via') === 'line';

  const run = useCallback(async () => {
    if (!liffId || !viaLine) return;
    setState({ phase: 'binding' });
    try {
      const sdk = await loadSdk();
      await sdk.init({ liffId, withLoginOnExternalBrowser: true });
      setLiff(sdk);
      if (!sdk.isLoggedIn()) { sdk.login({ redirectUri: window.location.href }); return; }
      const idToken = sdk.getIDToken();
      if (!idToken) throw new Error('no id token');
      const res = await fetch(bindUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id_token: idToken }) });
      const j = (await res.json().catch(() => ({}))) as { data?: { display_name?: string | null }; error?: string };
      if (!res.ok) throw new Error(j.error ?? 'bind failed');
      let isFriend: boolean | null = null;
      try { isFriend = (await sdk.getFriendship()).friendFlag; } catch { isFriend = null; }
      setState({ phase: 'bound', displayName: j.data?.display_name ?? null, isFriend });
    } catch (e) {
      setState({ phase: 'error', message: e instanceof Error ? e.message : 'LINE ไม่พร้อม' });
    }
  }, [liffId, viaLine, bindUrl]);

  useEffect(() => { void run(); }, [run]);

  return { state, viaLine, liff };
}
