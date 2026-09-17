'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { z } from 'zod';
import { SIGNAGE_LAYOUTS, SIGNAGE_TEMPLATES, SIGNAGE_THEMES, type SignageConfig } from '@/lib/signage/types';
import { SignageBoard, SignageDisabled } from '@/components/signage/signage-board';
import { useSignageFeed } from '@/components/signage/use-signage-feed';

const OverrideSchema = z.object({
  template: z.enum(SIGNAGE_TEMPLATES).optional(),
  theme: z.enum(SIGNAGE_THEMES).optional(),
  layout: z.enum(SIGNAGE_LAYOUTS).optional(),
});

type FullscreenElement = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void };
type FullscreenDocument = Document & { webkitExitFullscreen?: () => Promise<void> | void; webkitFullscreenElement?: Element | null };

function DisplayInner() {
  const { shopKey } = useParams<{ shopKey: string }>();
  const searchParams = useSearchParams();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [showControls, setShowControls] = useState(true);
  const [canFullscreen, setCanFullscreen] = useState(false);

  const branchId = searchParams.get('branch_id');
  const overrides = useMemo(() => {
    const parsed = OverrideSchema.safeParse({
      template: searchParams.get('template') ?? undefined,
      theme: searchParams.get('theme') ?? undefined,
      layout: searchParams.get('layout') ?? undefined,
    });
    return parsed.success ? parsed.data : {};
  }, [searchParams]);

  const feedUrl = useMemo(() => {
    if (!shopKey) return null;
    const qs = new URLSearchParams();
    if (branchId) qs.set('branch_id', branchId);
    const query = qs.toString();
    return `/api/public/shop/${encodeURIComponent(shopKey)}/display${query ? `?${query}` : ''}`;
  }, [shopKey, branchId]);

  const feed = useSignageFeed(feedUrl, { keepAwake: true });

  // Hide the floating control after a few seconds of no pointer activity.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const arm = () => {
      setShowControls(true);
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => setShowControls(false), 3000);
    };
    arm();
    window.addEventListener('pointermove', arm);
    window.addEventListener('keydown', arm);
    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener('pointermove', arm);
      window.removeEventListener('keydown', arm);
    };
  }, []);

  useEffect(() => {
    const el = document.documentElement as FullscreenElement;
    setCanFullscreen(Boolean(el.requestFullscreen || el.webkitRequestFullscreen));
  }, []);

  async function toggleFullscreen() {
    const doc = document as FullscreenDocument;
    const el = (rootRef.current ?? document.documentElement) as FullscreenElement;
    try {
      const active = doc.fullscreenElement ?? doc.webkitFullscreenElement;
      if (active) {
        if (doc.exitFullscreen) await doc.exitFullscreen();
        else doc.webkitExitFullscreen?.();
      } else if (el.requestFullscreen) {
        await el.requestFullscreen();
      } else {
        el.webkitRequestFullscreen?.();
      }
    } catch {
      // Some TV browsers reject fullscreen; the page is already full-viewport anyway.
    }
  }

  const payload = feed.payload;
  const config: SignageConfig | null = payload?.enabled ? { ...payload.config, ...overrides } : null;

  return (
    <div ref={rootRef} style={{ position: 'fixed', inset: 0, width: '100vw', height: '100vh', background: '#070d07' }}>
      {payload?.enabled === false ? (
        <SignageDisabled shopName={payload.shop.name} />
      ) : payload?.enabled && config ? (
        <SignageBoard data={payload.signage} config={config} mode="live" status={{ offline: feed.offline }} />
      ) : (
        <div style={{ display: 'grid', placeItems: 'center', height: '100%', color: '#8ca98c', fontFamily: 'var(--font-sans), sans-serif' }}>
          {feed.loading ? 'กำลังโหลดจอคิว...' : feed.error ? 'ไม่สามารถโหลดข้อมูลจอคิวได้ กำลังลองใหม่' : null}
        </div>
      )}

      {canFullscreen ? (
        <button
          type="button"
          onClick={() => void toggleFullscreen()}
          aria-label="Toggle fullscreen"
          style={{
            position: 'absolute',
            right: 16,
            bottom: 16,
            zIndex: 5,
            padding: '8px 14px',
            borderRadius: 999,
            border: '1px solid rgba(255,255,255,0.25)',
            background: 'rgba(0,0,0,0.55)',
            color: '#fff',
            fontSize: 13,
            cursor: 'pointer',
            opacity: showControls ? 1 : 0,
            transition: 'opacity 300ms ease',
            pointerEvents: showControls ? 'auto' : 'none',
          }}
        >
          ⛶ Fullscreen
        </button>
      ) : null}
    </div>
  );
}

export default function PublicDisplayPage() {
  return (
    <Suspense fallback={null}>
      <DisplayInner />
    </Suspense>
  );
}
