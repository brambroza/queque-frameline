'use client';

import { useEffect, useState } from 'react';
import { Box, Card, CardContent, Stack, Typography } from '@mui/material';
import gsap from 'gsap';

/** Chart colours. Fixed per meaning, checked for colour-blind separation. */
export const WAREHOUSE_COLORS = {
  yard: '#2a78d6',
  response: '#eb6834',
  dock: '#1baf7a',
  byWarehouse: '#4a3aa7',
  byTruck: '#eda100',
  good: '#0ca30c',
  bad: '#d03b3b',
} as const;

/** True when the device asks for reduced motion. */
export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Number that counts up to `value` whenever it changes. The first paint and
 * reduced-motion devices show the final value straight away.
 */
export function CountUp({ value, decimals = 0 }: { value: number; decimals?: number }) {
  const [shown, setShown] = useState(value);

  useEffect(() => {
    if (prefersReducedMotion()) {
      setShown(value);
      return;
    }
    const state = { v: 0 };
    const tween = gsap.to(state, { v: value, duration: 0.9, ease: 'power2.out', onUpdate: () => setShown(state.v), onComplete: () => setShown(value) });
    return () => {
      tween.kill();
    };
  }, [value]);

  return <>{shown.toLocaleString('th-TH', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}</>;
}

/** Card with a title row; the body is whatever the section draws. */
export function Panel({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card sx={{ minWidth: 0 }}>
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1} mb={1.5}>
          <Typography fontWeight={700}>{title}</Typography>
          {action}
        </Stack>
        {children}
      </CardContent>
    </Card>
  );
}

/** Change against the previous period. `lowerIsBetter` decides which way is good. */
export function Delta({ now, prev, unit, lowerIsBetter = false }: { now: number; prev: number; unit: string; lowerIsBetter?: boolean }) {
  const diff = Math.round((now - prev) * 10) / 10;
  if (!Number.isFinite(diff) || diff === 0) return <Typography component="span" variant="caption" color="text.secondary">— </Typography>;
  const good = lowerIsBetter ? diff < 0 : diff > 0;
  return (
    <Typography component="span" variant="caption" fontWeight={600} sx={{ color: good ? WAREHOUSE_COLORS.good : WAREHOUSE_COLORS.bad, whiteSpace: 'nowrap' }}>
      {diff > 0 ? '▲' : '▼'} {Math.abs(diff).toLocaleString('th-TH')} {unit}
    </Typography>
  );
}

/** Horizontal bar on a track; `marker` draws a tick (the plan) at that percentage. */
export function Bar({ pct, color = 'primary.main', marker }: { pct: number; color?: string; marker?: number }) {
  return (
    <Box sx={{ position: 'relative', mt: 0.5, height: 8, borderRadius: 1, bgcolor: 'action.hover' }}>
      <Box data-grow="x" sx={{ width: `${Math.max(0, Math.min(100, pct))}%`, height: '100%', borderRadius: 1, bgcolor: color, transformOrigin: 'left center' }} />
      {marker != null ? <Box sx={{ position: 'absolute', top: -3, bottom: -3, left: `${Math.max(0, Math.min(100, marker))}%`, width: 2, bgcolor: 'text.primary' }} /> : null}
    </Box>
  );
}

/** One labelled bar row: name left, figures right, bar below. */
export function BarRow({ name, figures, pct, color, marker }: { name: React.ReactNode; figures: React.ReactNode; pct: number; color?: string; marker?: number }) {
  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="baseline" spacing={1} flexWrap="wrap" useFlexGap>
        <Typography variant="body2" fontWeight={600} noWrap>{name}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ fontVariantNumeric: 'tabular-nums' }}>{figures}</Typography>
      </Stack>
      <Bar pct={pct} color={color} marker={marker} />
    </Box>
  );
}

/** Small coloured square for legends. */
export function Swatch({ color }: { color: string }) {
  return <Box component="span" sx={{ display: 'inline-block', width: 10, height: 10, borderRadius: 0.5, bgcolor: color, mr: 0.75 }} />;
}
