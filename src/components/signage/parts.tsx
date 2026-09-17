'use client';

import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import type { SignageConfig, SignageData, SignagePerson } from '@/lib/signage/types';
import type { SignageLabels } from './labels';
import styles from './signage-board.module.css';

export type SignageMode = 'live' | 'preview' | 'thumbnail';

/** Size bucket for a queue number so long codes (e.g. `T-1024`) still fit. */
export function heroSize(value: string): 'lg' | 'md' | 'sm' {
  const len = value.length;
  if (len <= 3) return 'lg';
  if (len <= 5) return 'md';
  return 'sm';
}

export function BoardHeader({
  data,
  config,
  clock,
  dateLabel,
}: {
  data: SignageData;
  config: SignageConfig;
  clock: string | null;
  dateLabel: string;
}) {
  const initial = data.shop.name.trim().slice(0, 1).toUpperCase() || 'Q';
  return (
    <header className={styles.header}>
      <div className={styles.brand}>
        {config.show_logo ? (
          data.shop.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element -- remote shop logos have no configured host allowlist
            <img className={styles.logo} src={data.shop.logo_url} alt="" />
          ) : (
            <span className={`${styles.logo} ${styles.logoFallback}`} aria-hidden="true">{initial}</span>
          )
        ) : null}
        <div>
          <div className={styles.shopName}>{data.shop.name || 'Queue Display'}</div>
          {data.branch ? <div className={styles.branchName}>{data.branch.name}</div> : null}
        </div>
      </div>
      <div className={styles.clockWrap}>
        {config.show_clock ? <div className={styles.clock}>{clock ?? '--:--:--'}</div> : null}
        <div className={styles.dateLabel}>{dateLabel}</div>
      </div>
    </header>
  );
}

export function HeroNumber({ value, xl = false, pulse = false }: { value: string; xl?: boolean; pulse?: boolean }) {
  return (
    <span className={`${styles.hero} ${xl ? styles.heroXl : ''} ${pulse ? styles.pulse : ''}`} data-size={heroSize(value)}>
      {value}
    </span>
  );
}

/** Secondary line under a hero number: service, resource, time. */
export function personMeta(p: SignagePerson): string {
  return [p.service_name, p.resource_name, p.start_time].filter(Boolean).join(' • ');
}

export function QueueRow({ person, active = false, showMeta = true }: { person: SignagePerson; active?: boolean; showMeta?: boolean }) {
  const meta = [person.service_name, person.resource_name].filter(Boolean).join(' • ');
  return (
    <div className={`${styles.row} ${active ? styles.rowActive : ''}`}>
      <span className={styles.rowNo}>{person.queue_number}</span>
      <span>
        {person.customer_name ? <div className={styles.rowName}>{person.customer_name}</div> : null}
        {showMeta && meta ? <div className={styles.rowMeta}>{meta}</div> : null}
        {!person.customer_name && !(showMeta && meta) ? <div className={styles.rowMeta}>&nbsp;</div> : null}
      </span>
      <span className={styles.rowTime}>{person.start_time ?? ''}</span>
    </div>
  );
}

const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/**
 * Count how many direct children fit fully inside the (overflow-hidden) container,
 * so a list can hide the partially clipped tail row instead of showing a cut edge.
 * Re-measures on resize; returns `Infinity` until measured.
 */
export function useFitChildren(ref: RefObject<HTMLElement | null>, itemCount: number): number {
  const [fit, setFit] = useState(Number.POSITIVE_INFINITY);

  useIsoLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const bottom = el.getBoundingClientRect().bottom;
      let count = 0;
      for (const child of Array.from(el.children) as HTMLElement[]) {
        if (child.getBoundingClientRect().bottom <= bottom + 1) count += 1;
        else break;
      }
      setFit((prev) => (prev === count ? prev : count));
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, itemCount]);

  return fit;
}

export function QueueList({ items, emptyText, max, activeIds }: { items: SignagePerson[]; emptyText: string; max?: number; activeIds?: Set<string> }) {
  const listRef = useRef<HTMLDivElement | null>(null);
  const shown = typeof max === 'number' ? items.slice(0, max) : items;
  const fit = useFitChildren(listRef, shown.length);
  if (shown.length === 0) return <div className={styles.empty}>{emptyText}</div>;
  return (
    <div className={styles.list} ref={listRef}>
      {shown.map((p, i) => (
        <div key={p.id} className={i >= fit ? styles.hiddenRow : undefined}>
          <QueueRow person={p} active={activeIds?.has(p.id)} />
        </div>
      ))}
    </div>
  );
}

export function WaitingChips({ items, labels, moreCount }: { items: SignagePerson[]; labels: SignageLabels; moreCount: number }) {
  if (items.length === 0 && moreCount <= 0) return null;
  return (
    <div className={styles.chips} style={{ maxHeight: 'calc(var(--sg-unit) * 3.2)' }}>
      {items.map((p) => (
        <span key={p.id} className={styles.chip}>{p.queue_number}</span>
      ))}
      {moreCount > 0 ? <span className={`${styles.chip} ${styles.chipMuted}`}>+{moreCount} {labels.waiting}</span> : null}
    </div>
  );
}

export function AnnouncementTicker({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <div className={styles.ticker} aria-live="off">
      <span className={styles.tickerDot} aria-hidden="true" />
      <div className={styles.tickerViewport}>
        <span className={styles.tickerTrack}>{text}</span>
      </div>
    </div>
  );
}

/** Deterministic pseudo-QR used in thumbnails so the mock never needs the qrcode lib. */
function QrPlaceholder() {
  const cells: boolean[] = [];
  let seed = 7;
  for (let i = 0; i < 121; i += 1) {
    seed = (seed * 9301 + 49297) % 233280;
    cells.push(seed / 233280 > 0.55);
  }
  return (
    <svg viewBox="0 0 11 11" className={styles.qrImg} aria-hidden="true" shapeRendering="crispEdges">
      <rect width="11" height="11" fill="#fff" />
      {cells.map((on, i) => (on ? <rect key={i} x={i % 11} y={Math.floor(i / 11)} width="1" height="1" fill="#111" /> : null))}
      <rect x="0" y="0" width="3" height="3" fill="#111" />
      <rect x="8" y="0" width="3" height="3" fill="#111" />
      <rect x="0" y="8" width="3" height="3" fill="#111" />
      <rect x="1" y="1" width="1" height="1" fill="#fff" />
      <rect x="9" y="1" width="1" height="1" fill="#fff" />
      <rect x="1" y="9" width="1" height="1" fill="#fff" />
    </svg>
  );
}

export function QrPanel({ url, mode, labels }: { url: string | null; mode: SignageMode; labels: SignageLabels }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!url || mode === 'thumbnail') {
      setDataUrl(null);
      return;
    }
    let cancelled = false;
    import('qrcode')
      .then((mod) => mod.toDataURL(url, { width: 512, margin: 1 }))
      .then((result) => {
        if (!cancelled) setDataUrl(result);
      })
      .catch(() => {
        if (!cancelled) setDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [url, mode]);

  if (!url) return null;
  return (
    <div className={styles.qr}>
      {mode === 'thumbnail' || !dataUrl ? (
        <QrPlaceholder />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- data URL generated on the client
        <img className={styles.qrImg} src={dataUrl} alt={labels.scan_to_book} />
      )}
      <div className={styles.qrText}>{labels.scan_to_book}</div>
    </div>
  );
}

export function StatTiles({ data, labels }: { data: SignageData; labels: SignageLabels }) {
  return (
    <div className={styles.stats}>
      <div className={styles.stat}>
        <div className={styles.statValue}>{data.totals.calling}</div>
        <div className={styles.statLabel}>{labels.also_calling}</div>
      </div>
      <div className={styles.stat}>
        <div className={styles.statValue}>{data.totals.waiting}</div>
        <div className={styles.statLabel}>{labels.waiting}</div>
      </div>
      <div className={styles.stat}>
        <div className={styles.statValue}>{data.totals.served_today}</div>
        <div className={styles.statLabel}>{labels.served_today}</div>
      </div>
    </div>
  );
}
