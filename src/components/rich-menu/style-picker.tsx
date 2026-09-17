'use client';

import { Box, Chip, Stack, TextField, ToggleButton, ToggleButtonGroup, Tooltip } from '@mui/material';
import { COLOR_PRESETS } from '@/lib/line/rich-menu/colors';
import { STYLE_KEYS, type StyleKey } from '@/lib/line/rich-menu/schema';

/** `short` always shows; `detail` only from `sm` up so the 3 toggles fit a phone row. */
const STYLE_LABELS: Record<StyleKey, { short: string; detail: string }> = {
  clean: { short: 'Clean', detail: 'พื้นขาว' },
  bold: { short: 'Bold', detail: 'พื้นสีเข้ม' },
  card: { short: 'Card', detail: 'การ์ดขาว' },
};

type Props = {
  style: StyleKey;
  primary: string;
  onStyleChange: (style: StyleKey) => void;
  onPrimaryChange: (hex: string) => void;
};

/** Style (clean/bold/card) + primary color. */
export function StylePicker({ style, primary, onStyleChange, onPrimaryChange }: Props) {
  return (
    <Stack spacing={1.5}>
      <ToggleButtonGroup
        exclusive
        size="small"
        value={style}
        onChange={(_, v: StyleKey | null) => { if (v) onStyleChange(v); }}
      >
        {STYLE_KEYS.map((key) => (
          <ToggleButton key={key} value={key} sx={{ textTransform: 'none', px: 1.5 }}>
            {STYLE_LABELS[key].short}
            <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>&nbsp;— {STYLE_LABELS[key].detail}</Box>
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
      <Stack direction="row" flexWrap="wrap" gap={1} alignItems="center">
        {COLOR_PRESETS.map((preset) => {
          const selected = primary.toLowerCase() === preset.value.toLowerCase();
          return (
            <Tooltip key={preset.value} title={preset.label}>
              <Box
                role="button"
                tabIndex={0}
                aria-label={preset.label}
                aria-pressed={selected}
                onClick={() => onPrimaryChange(preset.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onPrimaryChange(preset.value); }}
                sx={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  bgcolor: preset.value,
                  cursor: 'pointer',
                  outline: selected ? '2px solid' : '1px solid',
                  outlineColor: selected ? 'text.primary' : 'divider',
                  outlineOffset: 2,
                }}
              />
            </Tooltip>
          );
        })}
        <TextField
          size="small"
          type="color"
          label="สีกำหนดเอง"
          value={primary}
          onChange={(e) => onPrimaryChange(e.target.value)}
          sx={{ width: 120 }}
        />
        <Chip size="small" variant="outlined" label={primary.toUpperCase()} sx={{ fontFamily: 'monospace' }} />
      </Stack>
    </Stack>
  );
}
