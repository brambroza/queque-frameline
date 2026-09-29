'use client';

import { useEffect, type RefObject } from 'react';
import gsap from 'gsap';
import { prefersReducedMotion } from './warehouse-ui';

/**
 * Entrance motion for everything under `scope`, replayed whenever `key` changes
 * (new data, another tab). Marks it animates:
 *
 * - `data-grow="x"` / `data-grow="y"` — bars grow from their origin
 * - `data-pop` — cards and rows ease in
 *
 * The DOM already holds the final state; tweens run towards it and only clear
 * transform and opacity afterwards.
 */
export function useDashboardMotion(scope: RefObject<HTMLElement | null>, key: unknown): void {
  useEffect(() => {
    const root = scope.current;
    if (!root || prefersReducedMotion()) return;
    const ctx = gsap.context(() => {
      const all = (selector: string) => Array.from(root.querySelectorAll(selector));
      const ease = 'power3.out';
      const pop = all('[data-pop]');
      const growX = all('[data-grow="x"]');
      const growY = all('[data-grow="y"]');
      if (pop.length) gsap.from(pop, { y: 12, opacity: 0, duration: 0.45, stagger: 0.03, ease, clearProps: 'transform,opacity' });
      if (growX.length) gsap.from(growX, { scaleX: 0, duration: 0.8, stagger: 0.03, ease, clearProps: 'transform' });
      if (growY.length) gsap.from(growY, { scaleY: 0, duration: 0.6, stagger: 0.012, ease, clearProps: 'transform' });
    }, root);
    return () => ctx.revert();
  }, [scope, key]);
}
