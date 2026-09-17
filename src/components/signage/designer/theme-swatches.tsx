'use client';

import { Box, Stack, Tooltip } from '@mui/material';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import { SIGNAGE_THEMES, type SignageTheme } from '@/lib/signage/types';
import { SIGNAGE_PALETTES } from '@/components/signage/themes';

export function ThemeSwatches({ value, onChange }: { value: SignageTheme; onChange: (theme: SignageTheme) => void }) {
  return (
    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap role="radiogroup">
      {SIGNAGE_THEMES.map((id) => {
        const p = SIGNAGE_PALETTES[id];
        const selected = id === value;
        return (
          <Tooltip key={id} title={p.label_th} arrow>
            <Box
              component="button"
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={p.label_th}
              onClick={() => onChange(id)}
              sx={{
                width: 40,
                height: 40,
                p: 0,
                borderRadius: '50%',
                border: '2px solid',
                borderColor: selected ? 'primary.main' : 'divider',
                background: `linear-gradient(135deg, ${p.bg} 0%, ${p.bg2} 55%, ${p.accent} 56%, ${p.accent} 100%)`,
                cursor: 'pointer',
                display: 'grid',
                placeItems: 'center',
                boxShadow: selected ? '0 0 0 3px rgba(18,168,98,0.25)' : 'none',
                transition: 'box-shadow 120ms ease, border-color 120ms ease',
              }}
            >
              {selected ? <CheckRoundedIcon sx={{ fontSize: 18, color: p.isLight ? '#111' : '#fff', filter: 'drop-shadow(0 0 2px rgba(0,0,0,.6))' }} /> : null}
            </Box>
          </Tooltip>
        );
      })}
    </Stack>
  );
}
