'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { SignageConfig, SignageData } from '@/lib/signage/types';

/** Response of `/api/public/shop/[shopKey]/display`. */
export type SignageFeedPayload =
  | { enabled: false; shop: { name: string } }
  | { enabled: true; config: SignageConfig; signage: SignageData };

export type SignageFeedState = {
  payload: SignageFeedPayload | null;
  loading: boolean;
  /** True after two consecutive failed polls; the last good payload stays on screen. */
  offline: boolean;
  error: string | null;
  lastUpdatedAt: string | null;
  reload: () => Promise<void>;
};

const MIN_REFRESH = 5;
const MAX_REFRESH = 120;
const MAX_BACKOFF_MS = 60_000;

/**
 * Poll the public signage feed.
 *
 * - Interval comes from the payload's `refresh_seconds` (clamped 5..120).
 * - Pauses while the tab is hidden, resumes with an immediate fetch.
 * - Exponential backoff on failure (up to 60s); `offline` flips after 2 misses.
 * - Best-effort screen wake lock while `keepAwake` is on.
 */
export function useSignageFeed(url: string | null, options: { keepAwake?: boolean } = {}): SignageFeedState {
  const [payload, setPayload] = useState<SignageFeedPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);

  const failuresRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const refreshRef = useRef(10);
  const keepAwake = options.keepAwake ?? false;

  const clearTimer = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  };

  const fetchOnce = useCallback(async () => {
    if (!url) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await fetch(url, { cache: 'no-store', signal: controller.signal });
      const json = (await res.json()) as { data?: SignageFeedPayload; error?: string };
      if (!res.ok || !json.data) throw new Error(json.error ?? `HTTP ${res.status}`);
      setPayload(json.data);
      setLastUpdatedAt(new Date().toISOString());
      setError(null);
      setOffline(false);
      failuresRef.current = 0;
      if (json.data.enabled) {
        refreshRef.current = Math.min(MAX_REFRESH, Math.max(MIN_REFRESH, json.data.config.refresh_seconds));
      }
    } catch (e) {
      if (controller.signal.aborted) return;
      failuresRef.current += 1;
      setError(e instanceof Error ? e.message : 'fetch failed');
      if (failuresRef.current >= 2) setOffline(true);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [url]);

  const schedule = useCallback(() => {
    clearTimer();
    if (!url) return;
    const base = refreshRef.current * 1000;
    const backoff = failuresRef.current > 0 ? Math.min(MAX_BACKOFF_MS, base * 2 ** failuresRef.current) : base;
    timerRef.current = setTimeout(async () => {
      if (typeof document !== 'undefined' && document.hidden) {
        schedule();
        return;
      }
      await fetchOnce();
      schedule();
    }, backoff);
  }, [fetchOnce, url]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await fetchOnce();
      if (!cancelled) schedule();
    })();
    const onVisible = () => {
      if (document.hidden) return;
      clearTimer();
      void fetchOnce().then(() => schedule());
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      clearTimer();
      abortRef.current?.abort();
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [fetchOnce, schedule]);

  useEffect(() => {
    if (!keepAwake) return;
    type WakeLockSentinel = { release: () => Promise<void> };
    type NavigatorWithWakeLock = Navigator & { wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinel> } };
    let sentinel: WakeLockSentinel | null = null;
    let disposed = false;
    const request = async () => {
      try {
        const nav = navigator as NavigatorWithWakeLock;
        if (!nav.wakeLock || document.hidden) return;
        sentinel = await nav.wakeLock.request('screen');
      } catch {
        // Wake lock is best-effort; TVs without support just keep their own timeout.
      }
    };
    const onVisible = () => {
      if (!document.hidden && !disposed) void request();
    };
    void request();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      disposed = true;
      document.removeEventListener('visibilitychange', onVisible);
      void sentinel?.release();
    };
  }, [keepAwake]);

  const reload = useCallback(async () => {
    clearTimer();
    await fetchOnce();
    schedule();
  }, [fetchOnce, schedule]);

  return { payload, loading, offline, error, lastUpdatedAt, reload };
}
