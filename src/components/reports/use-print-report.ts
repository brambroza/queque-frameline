'use client';

import { useCallback, useEffect, useState } from 'react';

/** Body class that switches the print stylesheet to "report only" mode. */
export const REPORT_PRINTING_CLASS = 'report-printing';

/**
 * Drives the browser print dialog for the report sheet.
 *
 * `printing` is true from the click until the dialog closes; the caller mounts
 * the print sheet (via a portal into `document.body`) while it is true. The
 * body class hides the rest of the app in `@media print`, so "Save as PDF"
 * produces just the report.
 */
export function usePrintReport(): { printing: boolean; print: () => void } {
  const [printing, setPrinting] = useState(false);

  const print = useCallback(() => setPrinting(true), []);

  useEffect(() => {
    if (!printing) return;
    const body = document.body;
    body.classList.add(REPORT_PRINTING_CLASS);

    const done = () => setPrinting(false);
    window.addEventListener('afterprint', done);

    // Two frames so the portal content (and its emotion styles) is laid out before the dialog snapshots it.
    let raf2 = 0;
    const raf1 = window.requestAnimationFrame(() => {
      raf2 = window.requestAnimationFrame(() => window.print());
    });

    return () => {
      window.cancelAnimationFrame(raf1);
      window.cancelAnimationFrame(raf2);
      window.removeEventListener('afterprint', done);
      body.classList.remove(REPORT_PRINTING_CLASS);
    };
  }, [printing]);

  return { printing, print };
}
