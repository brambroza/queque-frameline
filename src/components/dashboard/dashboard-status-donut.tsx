'use client';

import { Box, Card, CardContent, Stack, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { useTranslation } from '@/lib/i18n/useTranslation';
import { getStatusMeta } from '@/lib/booking/status-meta';

/**
 * Status distribution for the selected range. Segment colours come from the same
 * palette keys `StatusChip` uses, so the donut, legend and table always agree.
 */
export function DashboardStatusDonut({ byStatus }: { byStatus: Array<{ status: string; count: number }> }) {
  const { t } = useTranslation('dashboard');
  const { t: ts } = useTranslation('status');
  const theme = useTheme();
  const total = byStatus.reduce((s, x) => s + x.count, 0);

  const colorFor = (status: string) => {
    const key = getStatusMeta(status).palette;
    if (key === 'default') return theme.palette.text.disabled;
    return theme.palette[key].main;
  };

  let acc = 0;
  const segments = byStatus.map((s) => {
    const p = total > 0 ? s.count / total : 0;
    const seg = { ...s, start: acc, len: p, color: colorFor(s.status) };
    acc += p;
    return seg;
  });

  return (
    <Card>
      <CardContent>
        <Typography fontWeight={700} mb={1}>{t('booking_status_chart', 'สถานะคิว')}</Typography>
        {total === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>{t('empty_range', 'ไม่มีข้อมูลในช่วงนี้')}</Typography>
        ) : (
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
            <Box sx={{ position: 'relative', width: 150, height: 150, flexShrink: 0 }}>
              <svg viewBox="0 0 44 44" width="150" height="150" role="img" aria-label={`${t('total', 'รวม')} ${total}`}>
                <circle cx="22" cy="22" r="15.915" fill="transparent" stroke={alpha(theme.palette.text.primary, 0.08)} strokeWidth="6" />
                {segments.map((seg) => (
                  <circle
                    key={seg.status}
                    cx="22"
                    cy="22"
                    r="15.915"
                    fill="transparent"
                    stroke={seg.color}
                    strokeWidth="6"
                    strokeDasharray={`${Math.max(0, seg.len - 0.008)} ${1 - seg.len + 0.008}`}
                    strokeDashoffset={-seg.start}
                    transform="rotate(-90 22 22)"
                    pathLength={1}
                  >
                    <title>{`${ts(seg.status, seg.status)} ${seg.count}`}</title>
                  </circle>
                ))}
              </svg>
              <Stack sx={{ position: 'absolute', inset: 0 }} alignItems="center" justifyContent="center">
                <Typography variant="h5" fontWeight={800} lineHeight={1}>{total}</Typography>
                <Typography variant="caption" color="text.secondary">{t('total', 'รวม')}</Typography>
              </Stack>
            </Box>
            <Stack spacing={0.75} sx={{ flex: 1, width: '100%', minWidth: 0 }}>
              {segments.map((seg) => (
                <Stack key={seg.status} direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                  <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 0 }}>
                    <Box sx={{ width: 10, height: 10, borderRadius: 0.75, bgcolor: seg.color, flexShrink: 0 }} />
                    <Typography variant="body2" noWrap>{ts(seg.status, seg.status)}</Typography>
                  </Stack>
                  <Typography variant="body2" fontWeight={600} sx={{ whiteSpace: 'nowrap' }}>
                    {seg.count} <Typography component="span" variant="caption" color="text.secondary">({Math.round(seg.len * 100)}%)</Typography>
                  </Typography>
                </Stack>
              ))}
            </Stack>
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}
