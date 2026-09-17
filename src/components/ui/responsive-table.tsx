'use client';

import type { ReactNode } from 'react';
import { Box, Divider, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';

/**
 * Column definition shared by the desktop table and the phone card list.
 * `render` is used by both, so chips / buttons / formatted values stay identical.
 */
export type ResponsiveColumn<T> = {
  key: string;
  label: ReactNode;
  render: (row: T) => ReactNode;
  align?: 'left' | 'right' | 'center';
  width?: number | string;
  /**
   * Role of this column on the phone card:
   * - `title`    — first line, bold
   * - `subtitle` — second line, muted caption
   * - `meta`     — a `label: value` row (default)
   * - `hidden`   — table only
   */
  card?: 'title' | 'subtitle' | 'meta' | 'hidden';
};

type CardListProps<T> = {
  rows: T[];
  rowKey: (row: T) => string;
  columns: ResponsiveColumn<T>[];
  /** Row actions, rendered top-right of each card (and in the last table column). */
  actions?: (row: T) => ReactNode;
  /** Rendered once (outside the table/card toggle) when `rows` is empty. */
  emptyState?: ReactNode;
  /**
   * Full custom card for a row. When given, the generic title/subtitle/meta
   * layout is skipped and cards are stacked with spacing instead of dividers.
   */
  renderCard?: (row: T) => ReactNode;
  sx?: SxProps<Theme>;
};

type ResponsiveTableProps<T> = CardListProps<T> & {
  /** Table min width on sm+; narrower viewports scroll horizontally. */
  minWidth?: number;
  size?: 'small' | 'medium';
  /** Header of the actions column. */
  actionsLabel?: ReactNode;
  /** Breakpoint at which the card list gives way to the table. */
  cardBreakpoint?: 'sm' | 'md';
  /** Extra styles for the phone card list only (e.g. padding when the parent has none). */
  cardListSx?: SxProps<Theme>;
};

/**
 * One card per row: title / subtitle / `label: value` grid, actions top-right.
 * Use on its own inside legacy Tailwind pages (wrap with `sm:hidden` or pass `sx`)
 * or through `ResponsiveTable`.
 */
export function MobileCardList<T>({ rows, rowKey, columns, actions, emptyState, renderCard, sx }: CardListProps<T>) {
  if (rows.length === 0) return emptyState ? <Box sx={sx}>{emptyState}</Box> : null;

  if (renderCard) {
    return (
      <Stack spacing={1.5} sx={sx}>
        {rows.map((row) => (
          <Box key={rowKey(row)}>{renderCard(row)}</Box>
        ))}
      </Stack>
    );
  }

  const titleCol = columns.find((c) => c.card === 'title');
  const subtitleCol = columns.find((c) => c.card === 'subtitle');
  const metaCols = columns.filter((c) => (c.card ?? 'meta') === 'meta');

  return (
    <Stack divider={<Divider />} sx={sx}>
      {rows.map((row) => (
        <Box key={rowKey(row)} sx={{ p: 1.5, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
          {(titleCol || subtitleCol || actions) && (
            <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                {titleCol ? (
                  <Typography variant="body2" fontWeight={700} sx={{ overflowWrap: 'anywhere' }}>
                    {titleCol.render(row)}
                  </Typography>
                ) : null}
                {subtitleCol ? (
                  <Typography variant="caption" color="text.secondary" component="div" sx={{ overflowWrap: 'anywhere' }}>
                    {subtitleCol.render(row)}
                  </Typography>
                ) : null}
              </Box>
              {actions ? <Box sx={{ flexShrink: 0, display: 'flex', gap: 0.5 }}>{actions(row)}</Box> : null}
            </Box>
          )}
          {metaCols.length > 0 && (
            <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(84px, 30%) 1fr', columnGap: 1, rowGap: 0.5 }}>
              {metaCols.map((c) => (
                <Box key={c.key} sx={{ display: 'contents' }}>
                  <Typography variant="caption" color="text.secondary" sx={{ pt: '1px' }}>
                    {c.label}
                  </Typography>
                  <Typography variant="body2" component="div" sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>
                    {c.render(row)}
                  </Typography>
                </Box>
              ))}
            </Box>
          )}
        </Box>
      ))}
    </Stack>
  );
}

/**
 * MUI table on `cardBreakpoint` and up (inside a horizontal scroll box), card list
 * below it. Both are in the DOM and toggled with CSS so SSR renders without a flash.
 */
export function ResponsiveTable<T>({
  rows,
  rowKey,
  columns,
  actions,
  emptyState,
  renderCard,
  sx,
  minWidth = 640,
  size = 'medium',
  actionsLabel = 'Action',
  cardBreakpoint = 'sm',
  cardListSx,
}: ResponsiveTableProps<T>) {
  if (rows.length === 0) return emptyState ? <Box sx={sx}>{emptyState}</Box> : null;

  return (
    <Box sx={sx}>
      <Box sx={{ display: { xs: 'none', [cardBreakpoint]: 'block' }, overflowX: 'auto' }}>
        <Table size={size} sx={{ minWidth }}>
          <TableHead>
            <TableRow>
              {columns.map((c) => (
                <TableCell key={c.key} align={c.align ?? 'left'} sx={{ width: c.width }}>
                  {c.label}
                </TableCell>
              ))}
              {actions ? <TableCell align="right">{actionsLabel}</TableCell> : null}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={rowKey(row)} hover>
                {columns.map((c) => (
                  <TableCell key={c.key} align={c.align ?? 'left'}>
                    {c.render(row)}
                  </TableCell>
                ))}
                {actions ? <TableCell align="right">{actions(row)}</TableCell> : null}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>
      <MobileCardList
        rows={rows}
        rowKey={rowKey}
        columns={columns}
        actions={actions}
        renderCard={renderCard}
        sx={[{ display: { xs: 'flex', [cardBreakpoint]: 'none' } }, ...(Array.isArray(cardListSx) ? cardListSx : [cardListSx])]}
      />
    </Box>
  );
}
