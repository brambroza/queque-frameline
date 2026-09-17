'use client';

import { Box, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';

/**
 * Typographic building blocks shared by every section of the report document,
 * so the screen and the printed sheet look identical.
 */

export const DOC_FONT = { body: 12.5, small: 11, caption: 10.5 } as const;

const cellSx: SxProps<Theme> = { fontSize: DOC_FONT.body, py: 0.6, px: 1, lineHeight: 1.4, borderColor: 'divider' };
const headSx: SxProps<Theme> = { ...cellSx, fontWeight: 700, color: 'text.secondary', fontSize: DOC_FONT.small, textTransform: 'none', bgcolor: 'action.hover', whiteSpace: 'nowrap' };

/**
 * Report section separated by a rule. Sections carry no heading text; an
 * optional `hint` caption (e.g. "เทียบช่วงก่อนหน้า …") sits on the rule instead.
 */
export function DocSection({ hint, children, avoidBreak = true }: { hint?: string; children: React.ReactNode; avoidBreak?: boolean }) {
  return (
    <Box component="section" sx={{ mt: 3, breakInside: avoidBreak ? 'avoid' : 'auto' }}>
      <Box sx={{ borderBottom: '2px solid', borderColor: 'primary.main', pb: 0.5, mb: 1.25, minHeight: 4 }}>
        {hint ? <Typography sx={{ fontSize: DOC_FONT.caption, color: 'text.secondary' }}>{hint}</Typography> : null}
      </Box>
      {children}
    </Box>
  );
}

/** Sub-heading inside a section. */
export function DocSubTitle({ children }: { children: React.ReactNode }) {
  return <Typography sx={{ fontSize: DOC_FONT.body, fontWeight: 700, mb: 0.75, color: 'text.primary' }}>{children}</Typography>;
}

/** Body paragraph. */
export function DocText({ children, sx }: { children: React.ReactNode; sx?: SxProps<Theme> }) {
  return <Typography sx={{ fontSize: DOC_FONT.body, lineHeight: 1.7, color: 'text.primary', ...((sx as object) ?? {}) }}>{children}</Typography>;
}

/** Muted one-liner (empty state, notes). */
export function DocMuted({ children }: { children: React.ReactNode }) {
  return <Typography sx={{ fontSize: DOC_FONT.small, color: 'text.secondary' }}>{children}</Typography>;
}

export type DocColumn<T> = {
  key: string;
  label: string;
  align?: 'left' | 'right' | 'center';
  width?: number | string;
  render: (row: T) => React.ReactNode;
};

/**
 * Compact ruled table. `footer` renders a bold last row (totals).
 */
export function DocTable<T>({ columns, rows, rowKey, emptyText, footer }: { columns: DocColumn<T>[]; rows: T[]; rowKey: (row: T) => string; emptyText: string; footer?: React.ReactNode[] }) {
  return (
    // `.report-scroll` lets wide tables scroll sideways on phones; print CSS resets it to `visible`.
    <Box className="report-scroll" sx={{ overflowX: 'auto' }}>
    <Table size="small" sx={{ tableLayout: 'auto' }}>
      <TableHead>
        <TableRow>
          {columns.map((c) => (
            <TableCell key={c.key} align={c.align ?? 'left'} sx={{ ...headSx, width: c.width }}>{c.label}</TableCell>
          ))}
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.length === 0 ? (
          <TableRow>
            <TableCell colSpan={columns.length} sx={{ ...cellSx, color: 'text.secondary', textAlign: 'center', py: 1.5 }}>{emptyText}</TableCell>
          </TableRow>
        ) : (
          rows.map((r) => (
            <TableRow key={rowKey(r)} sx={{ breakInside: 'avoid' }}>
              {columns.map((c) => (
                <TableCell key={c.key} align={c.align ?? 'left'} sx={cellSx}>{c.render(r)}</TableCell>
              ))}
            </TableRow>
          ))
        )}
        {footer && rows.length > 0 ? (
          <TableRow>
            {footer.map((cellContent, i) => (
              <TableCell key={columns[i]?.key ?? i} align={columns[i]?.align ?? 'left'} sx={{ ...cellSx, fontWeight: 700, borderTop: '2px solid', borderTopColor: 'divider' }}>{cellContent}</TableCell>
            ))}
          </TableRow>
        ) : null}
      </TableBody>
    </Table>
    </Box>
  );
}

/** Inline share bar used in breakdown tables. */
export function DocBar({ pct, color = 'primary.main' }: { pct: number; color?: string }) {
  return (
    <Box sx={{ height: 6, borderRadius: 3, bgcolor: 'action.hover', overflow: 'hidden', minWidth: 60 }}>
      <Box sx={{ width: `${Math.max(0, Math.min(100, pct))}%`, height: '100%', bgcolor: color, borderRadius: 3 }} />
    </Box>
  );
}
