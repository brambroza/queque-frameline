'use client';

import { Card, CardContent, IconButton, Stack, TextField, ToggleButton, ToggleButtonGroup, Tooltip, Typography } from '@mui/material';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import { useTranslation } from '@/lib/i18n/useTranslation';
import type { ReportPreset } from '@/lib/reports/range-presets';
import { reportRangeLabel } from './report-utils';

export type ReportFilter = { preset: ReportPreset; from: string; to: string };

/**
 * Preset labels in display order: queue sheets (today / tomorrow / upcoming),
 * calendar periods, then look-back windows for analysis.
 */
export function usePresetLabels(): Array<{ value: ReportPreset; label: string }> {
  const { t } = useTranslation('reports');
  return [
    { value: 'today', label: t('preset_today', 'วันนี้') },
    { value: 'tomorrow', label: t('preset_tomorrow', 'พรุ่งนี้') },
    { value: 'next7', label: t('preset_next7', 'ล่วงหน้า 7 วัน') },
    { value: 'week', label: t('preset_week', 'สัปดาห์นี้') },
    { value: 'month', label: t('preset_month', 'เดือนนี้') },
    { value: 'last7', label: t('preset_last7', 'ย้อนหลัง 7 วัน') },
    { value: 'last30', label: t('preset_last30', 'ย้อนหลัง 30 วัน') },
    { value: 'custom', label: t('preset_custom', 'กำหนดเอง') },
  ];
}

/**
 * Sticky range picker for the report page. Same shape as the dashboard bar but
 * with forward-looking presets so a shop can print tomorrow's queue.
 */
export function ReportFilterBar({
  value,
  onChange,
  onRefresh,
  resolvedFrom,
  resolvedTo,
  loading,
}: {
  value: ReportFilter;
  onChange: (next: ReportFilter) => void;
  onRefresh: () => void;
  resolvedFrom?: string;
  resolvedTo?: string;
  loading?: boolean;
}) {
  const { t } = useTranslation('reports');
  const presets = usePresetLabels();
  const label = resolvedFrom && resolvedTo ? reportRangeLabel(t, value.preset, resolvedFrom, resolvedTo) : '';

  return (
    <Card sx={{ position: 'sticky', top: 8, zIndex: 5 }}>
      <CardContent sx={{ py: 1.25, '&:last-child': { pb: 1.25 } }}>
        <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
          <ToggleButtonGroup
            size="small"
            exclusive
            value={value.preset}
            onChange={(_, next: ReportPreset | null) => {
              if (next) onChange({ ...value, preset: next });
            }}
            aria-label={t('range', 'ช่วงเวลา')}
            sx={{ flexWrap: 'wrap' }}
          >
            {presets.map((p) => (
              <ToggleButton key={p.value} value={p.value}>{p.label}</ToggleButton>
            ))}
          </ToggleButtonGroup>

          {value.preset === 'custom' ? (
            <Stack direction="row" spacing={1} alignItems="center">
              <TextField
                id="report-from"
                type="date"
                size="small"
                label={t('from', 'จากวันที่')}
                value={value.from}
                onChange={(e) => onChange({ ...value, from: e.target.value })}
                slotProps={{ inputLabel: { shrink: true } }}
              />
              <TextField
                id="report-to"
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
