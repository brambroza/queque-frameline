'use client';

import { useEffect, useState } from 'react';

/**
 * Hydration-safe wall clock. Returns `null` until mounted so server and first
 * client render match, then ticks every second while `enabled`.
 */
export function useClock(enabled: boolean, lang: 'th' | 'en' = 'th'): string | null {
  const [value, setValue] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setValue(null);
      return;
    }
    const locale = lang === 'en' ? 'en-GB' : 'th-TH';
    const tick = () => setValue(new Date().toLocaleTimeString(locale, { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [enabled, lang]);

  return value;
}
