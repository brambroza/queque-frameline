'use client';

import { stickyBelowAppBar } from '@/components/layout/sticky-offset';
import { Card, CardContent, IconButton, Stack, TextField, ToggleButton, ToggleButtonGroup, Tooltip, Typography } from '@mui/material';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import { useTranslation } from '@/lib/i18n/useTranslation';
import type { RangeKind } from '@/types/dashboard';
import { rangeLabel } from './dashboard-utils';

export type DashboardFilter = { range: RangeKind; from: string; to: string };

/**
 * Sticky range picker: today / this week / this month / custom from–to.
 * Custom bounds are edited locally and applied on change; the resolved bounds
 * (`resolvedFrom`/`resolvedTo`) come back from the API so the label is exact.
 */
export function DashboardFilterBar({
  value,
  onChange,
  onRefresh,
  resolvedFrom,
  resolvedTo,
  loading,
}: {
  value: DashboardFilter;
  onChange: (next: DashboardFilter) => void;
  onRefresh: () => void;
  resolvedFrom?: string;
  resolvedTo?: string;
  loading?: boolean;
}) {
  const { t } = useTranslation('dashboard');

  const label = resolvedFrom && resolvedTo ? rangeLabel(t, value.range, resolvedFrom, resolvedTo) : '';

  return (
    <Card sx={{ position: 'sticky', top: stickyBelowAppBar(), zIndex: 5 }}>
      <CardContent sx={{ py: 1.25, '&:last-child': { pb: 1.25 } }}>
        <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
          <ToggleButtonGroup
            size="small"
            exclusive
            value={value.range}
            onChange={(_, next: RangeKind | null) => {
              if (next) onChange({ ...value, range: next });
            }}
            aria-label={t('range', 'ช่วงเวลา')}
          >
            <ToggleButton value="today">{t('range_today', 'วันนี้')}</ToggleButton>
            <ToggleButton value="week">{t('range_week', 'สัปดาห์นี้')}</ToggleButton>
            <ToggleButton value="month">{t('range_month', 'เดือนนี้')}</ToggleButton>
            <ToggleButton value="custom">{t('range_custom', 'กำหนดเอง')}</ToggleButton>
          </ToggleButtonGroup>

          {value.range === 'custom' ? (
            <Stack direction="row" spacing={1} alignItems="center">
              <TextField
                id="dashboard-from"
                type="date"
                size="small"
                label={t('from', 'จากวันที่')}
                value={value.from}
                onChange={(e) => onChange({ ...value, from: e.target.value })}
                slotProps={{ inputLabel: { shrink: true } }}
              />
              <TextField
                id="dashboard-to"
                type="date"
                size="small"
                label={t('to', 'ถึงวันที่')}
                value={value.to}
                onChange={(e) => onChange({ ...value, to: e.target.value })}
                slotProps={{ inputLabel: { shrink: true } }}
              />
            </Stack>
          ) : null}

          <Stack direction="row" spacing={1} alignItems="center" sx={{ ml: { sm: 'auto' } }}>
            {label ? (
              <Typography variant="body2" color="text.secondary">
                {t('showing', 'ช่วงที่แสดง')}: <Typography component="span" variant="body2" fontWeight={600} color="text.primary">{label}</Typography>
              </Typography>
            ) : null}
            <Tooltip title={t('refresh', 'รีเฟรช')}>
              <span>
                <IconButton size="small" onClick={onRefresh} disabled={loading} aria-label={t('refresh', 'รีเฟรช')}>
                  <RefreshRoundedIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}
