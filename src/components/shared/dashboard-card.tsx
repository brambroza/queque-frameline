'use client';

import { Box, Card, CardContent, Stack, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';

export type StatTone = 'default' | 'primary' | 'success' | 'warning' | 'info' | 'error';

/**
 * Stat tile สำหรับ dashboard — premium look: ไอคอนวงกลมสีนุ่ม + ตัวเลขเด่น
 * รองรับ light/dark ผ่าน theme palette (ไม่ hardcode สี)
 */
export function DashboardCard({
  label,
  value,
  tone = 'default',
  icon,
  hint,
  color,
}: {
  label: string;
  value: string | number;
  tone?: StatTone;
  icon?: React.ReactNode;
  hint?: string;
  /** @deprecated ใช้ tone แทน — คงไว้เพื่อ backward-compat */
  color?: string;
}) {
  const theme = useTheme();

  const toneColor =
    tone === 'default'
      ? theme.palette.text.primary
      : theme.palette[tone].main;
  const accent = color ?? toneColor;
  const softBg =
    tone === 'default'
      ? alpha(theme.palette.text.primary, theme.palette.mode === 'dark' ? 0.1 : 0.06)
      : alpha(theme.palette[tone].main, theme.palette.mode === 'dark' ? 0.18 : 0.12);

  return (
    <Card
      sx={{
        transition: 'transform .18s ease, box-shadow .18s ease',
        '&:hover': { transform: 'translateY(-2px)', boxShadow: 4 },
      }}
    >
      <CardContent sx={{ p: 2.2 }}>
        <Stack direction="row" spacing={1.4} alignItems="flex-start">
          {icon ? (
            <Box
              sx={{
                flexShrink: 0,
                width: 40,
                height: 40,
                borderRadius: 2,
                display: 'grid',
                placeItems: 'center',
                bgcolor: softBg,
                color: accent,
              }}
            >
              {icon}
            </Box>
          ) : null}
          <Stack spacing={0.3} sx={{ minWidth: 0 }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }} noWrap>
              {label}
            </Typography>
            <Typography variant="h4" fontWeight={800} sx={{ color: accent, lineHeight: 1.1 }}>
              {value}
            </Typography>
            {hint ? (
              <Typography variant="caption" color="text.secondary">
                {hint}
              </Typography>
            ) : null}
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}
