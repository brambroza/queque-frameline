'use client';

import { Box, ButtonBase, Typography } from '@mui/material';
import { alpha, getContrastRatio } from '@mui/material/styles';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import type { BankCode } from '@/types/db';
import { MOBILE_BANKS } from '@/lib/payments/mobile-banking/banks';

export interface BankGridBank {
  code: BankCode | string;
  name: string;
}

/** Text colour that stays readable on a bank's brand colour (KMA yellow needs dark text). */
function textOn(background: string): string {
  return getContrastRatio(background, '#ffffff') >= 3 ? '#ffffff' : '#111827';
}

/**
 * Bank logo path. The SVGs (from omise/banks-logo, MIT) are white glyphs meant
 * to sit on the bank's brand colour, so they are only ever drawn on that tile.
 */
function logoSrc(code: string): string {
  return `/images/banks/${encodeURIComponent(code)}.svg`;
}

/**
 * Two-column grid of bank-app buttons in each bank's brand colour with the
 * bank's logo.
 *
 * Used by the LIFF booking picker (choose which app to open) and the payment
 * panel (switch bank / re-issue). Colours come from the shared registry so a
 * bank looks the same everywhere.
 */
export function BankGrid({
  banks,
  value,
  onChange,
  disabled,
  size = 'medium',
}: {
  banks: BankGridBank[];
  /** Selected bank code; undefined when the grid is a plain action list. */
  value?: string | null;
  onChange: (code: string) => void;
  disabled?: boolean;
  size?: 'small' | 'medium';
}) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
      {banks.map((bank) => {
        const brand = MOBILE_BANKS.find((b) => b.code === bank.code)?.color ?? '#374151';
        const selected = value === bank.code;
        const fg = textOn(brand);
        return (
          <ButtonBase
            key={bank.code}
            disabled={disabled}
            onClick={() => onChange(bank.code)}
            aria-pressed={value === undefined ? undefined : selected}
            sx={{
              position: 'relative',
              justifyContent: 'flex-start',
              gap: 1,
              px: 1.5,
              py: size === 'small' ? 1 : 1.5,
              borderRadius: '14px',
              bgcolor: brand,
              color: fg,
              textAlign: 'left',
              boxShadow: selected ? `0 0 0 3px ${alpha(brand, 0.35)}` : 'none',
              outline: selected ? '2px solid' : '2px solid transparent',
              outlineColor: selected ? 'primary.main' : 'transparent',
              outlineOffset: 2,
              opacity: disabled ? 0.6 : 1,
              transition: 'box-shadow 120ms ease, transform 120ms ease',
              '&:active': { transform: 'scale(0.98)' },
            }}
          >
            <Box
              component="span"
              aria-hidden
              sx={{
                width: size === 'small' ? 32 : 40,
                height: size === 'small' ? 32 : 40,
                borderRadius: '10px',
                display: 'grid',
                placeItems: 'center',
                bgcolor: alpha(fg, 0.14),
                flexShrink: 0,
                overflow: 'hidden',
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- static SVG, no optimisation needed */}
              <img
                src={logoSrc(String(bank.code))}
                alt=""
                width={size === 'small' ? 32 : 40}
                height={size === 'small' ? 32 : 40}
                style={{ display: 'block', width: '100%', height: '100%' }}
                onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }}
              />
            </Box>
            <Typography variant="body2" sx={{ fontWeight: 700, lineHeight: 1.2, color: 'inherit' }}>
              {bank.name}
            </Typography>
            {selected ? (
              <CheckRoundedIcon sx={{ ml: 'auto', fontSize: 18, color: 'inherit', flexShrink: 0 }} />
            ) : null}
          </ButtonBase>
        );
      })}
    </Box>
  );
}
