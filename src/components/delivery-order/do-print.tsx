'use client';

import { createPortal } from 'react-dom';
import { usePrintReport } from '@/components/reports/use-print-report';
import { REPORT_PRINT_ROOT_ID } from '@/components/reports/report-print-sheet';
import { DoDocument, type DoDocumentData } from './do-document';

/**
 * Browser-print for a DO ("Save as PDF" in the print dialog). Reuses the
 * report print stylesheet: while printing, only `#report-print-root` is visible.
 *
 * @returns `print()` to open the dialog and `sheet` to render somewhere in the tree.
 */
export function useDoPrint(data: DoDocumentData | null, qr?: React.ReactNode): { print: () => void; sheet: React.ReactNode } {
  const { printing, print } = usePrintReport();
  const sheet =
    printing && data && typeof document !== 'undefined'
      ? createPortal(
          <div id={REPORT_PRINT_ROOT_ID} style={{ display: 'none', background: '#fff' }}>
            <DoDocument data={data} qr={qr} />
          </div>,
          document.body,
        )
      : null;
  return { print, sheet };
}
