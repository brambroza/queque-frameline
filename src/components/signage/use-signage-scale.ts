'use client';

import { useEffect, type RefObject } from 'react';
import type { SignageLayout } from '@/lib/signage/types';

/**
 * Keep `--sg-unit` on the root element equal to 1% of the "design width" of the
 * board, so every size written as `calc(var(--sg-unit) * N)` scales identically
 * from a 360px thumbnail up to a 4K TV.
 *
 * Landscape boards are designed on a 16:9 canvas, portrait on 9:16. The unit is
 * derived from whichever dimension is the constraint so the composition never
 * overflows the container.
 */
export function useSignageScale(ref: RefObject<HTMLElement | null>, layout: SignageLayout) {
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;

    const apply = (width: number, height: number) => {
      if (width <= 0 || height <= 0) return;
      const ratio = layout === 'portrait' ? 9 / 16 : 16 / 9;
      const designWidth = Math.min(width, height * ratio);
      el.style.setProperty('--sg-unit', `${designWidth / 100}px`);
    };

    apply(el.clientWidth, el.clientHeight);
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      apply(entry.contentRect.width, entry.contentRect.height);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, layout]);
}
