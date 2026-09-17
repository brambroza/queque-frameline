'use client';

import { alpha, Box, ButtonBase, Typography } from '@mui/material';
import { BUSINESS_TYPE_LABELS, BUSINESS_TYPES, type BusinessType } from '@/lib/line/rich-menu/business-types';
import { iconDataUrl } from '@/lib/line/rich-menu/icons';
import { LAYOUTS } from '@/lib/line/rich-menu/layouts';
import { templateForBusiness } from '@/lib/line/rich-menu/templates';

type Props = {
  value: BusinessType | null;
  onChange: (type: BusinessType) => void;
};

/** Grid of the 12 business types; picking one applies its master template. */
export function BusinessTypePicker({ value, onChange }: Props) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 1 }}>
      {BUSINESS_TYPES.map((type) => {
        const template = templateForBusiness(type);
        const selected = value === type;
        return (
          <ButtonBase
            key={type}
            onClick={() => onChange(type)}
            aria-pressed={selected}
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              gap: 0.75,
              p: 1.25,
              borderRadius: 2,
              border: '1px solid',
              borderColor: selected ? 'primary.main' : 'divider',
              bgcolor: selected ? (t) => alpha(t.palette.primary.main, 0.08) : 'background.paper',
              boxShadow: selected ? (t) => `inset 0 0 0 1px ${t.palette.primary.main}` : 'none',
              textAlign: 'left',
              transition: 'border-color .12s, background-color .12s',
              '&:hover': { borderColor: selected ? 'primary.main' : 'text.disabled' },
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img alt="" width={28} height={28} src={iconDataUrl(template.buttons[0].iconKey, template.palette.primary, '#ffffff', 28)} />
            <Typography variant="body2" fontWeight={600} lineHeight={1.3}>{BUSINESS_TYPE_LABELS[type]}</Typography>
            <Typography variant="caption" color="text.secondary">{LAYOUTS[template.layout].label} · {template.style}</Typography>
          </ButtonBase>
        );
      })}
    </Box>
  );
}
