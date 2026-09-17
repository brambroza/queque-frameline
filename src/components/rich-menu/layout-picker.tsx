'use client';

import { alpha, ButtonBase, Stack, Typography } from '@mui/material';
import { LAYOUT_KEYS, LAYOUTS, type LayoutKey } from '@/lib/line/rich-menu/layouts';

type Props = { value: LayoutKey; onChange: (layout: LayoutKey) => void };

/** Layout toggles with thumbnails drawn from the real cell geometry. */
export function LayoutPicker({ value, onChange }: Props) {
  return (
    <Stack direction="row" flexWrap="wrap" gap={1}>
      {LAYOUT_KEYS.map((key) => {
        const layout = LAYOUTS[key];
        const selected = value === key;
        return (
          <ButtonBase
            key={key}
            onClick={() => onChange(key)}
            aria-pressed={selected}
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 0.5,
              px: 1.25,
              py: 1,
              borderRadius: 2,
              border: '1px solid',
              borderColor: selected ? 'primary.main' : 'divider',
              bgcolor: selected ? (t) => alpha(t.palette.primary.main, 0.08) : 'background.paper',
              color: selected ? 'text.primary' : 'text.secondary',
            }}
          >
            <svg viewBox="0 0 72 48" width={72} height={48} aria-hidden>
              {layout.cells.map((c, i) => (
                <rect
                  key={i}
                  x={(c.x / 2500) * 72 + 0.5}
                  y={(c.y / 1686) * 48 + 0.5}
                  width={(c.width / 2500) * 72 - 1}
                  height={(c.height / 1686) * 48 - 1}
                  rx={2}
                  fill={selected ? '#ffffff' : 'currentColor'}
                  fillOpacity={selected ? 1 : 0.12}
                  stroke="currentColor"
                  strokeOpacity={selected ? 1 : 0.4}
                  strokeWidth={1}
                />
              ))}
            </svg>
            <Typography variant="caption">{layout.label}</Typography>
            <Typography variant="caption" color="text.disabled" sx={{ fontFamily: 'monospace' }}>{layout.width}×{layout.height}</Typography>
          </ButtonBase>
        );
      })}
    </Stack>
  );
}
