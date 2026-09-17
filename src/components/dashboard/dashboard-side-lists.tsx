'use client';

import { Box, Card, CardContent, Stack, Typography } from '@mui/material';
import { useTranslation } from '@/lib/i18n/useTranslation';
import type { DashboardNamedCount } from '@/types/dashboard';

function RankedList({ title, rows, emptyText, pctSuffix, barOf }: { title: string; rows: DashboardNamedCount[]; emptyText: string; pctSuffix: string; barOf: (r: DashboardNamedCount, max: number) => number }) {
  const max = rows.reduce((m, r) => Math.max(m, r.count), 0) || 1;
  return (
    <Card>
      <CardContent>
        <Typography fontWeight={700} mb={1}>{title}</Typography>
        {rows.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>{emptyText}</Typography>
        ) : (
          <Stack spacing={1}>
            {rows.map((r) => (
              <Box key={r.name}>
                <Stack direction="row" justifyContent="space-between" alignItems="baseline" spacing={1}>
                  <Typography variant="body2" noWrap>{r.name}</Typography>
                  <Typography variant="body2" fontWeight={600} sx={{ whiteSpace: 'nowrap' }}>
                    {r.count} <Typography component="span" variant="caption" color="text.secondary">{pctSuffix ? `· ${pctSuffix} ${r.pct}%` : `(${r.pct}%)`}</Typography>
                  </Typography>
                </Stack>
                <Box sx={{ mt: 0.5, height: 6, borderRadius: 3, bgcolor: 'action.hover', overflow: 'hidden' }}>
                  <Box sx={{ width: `${Math.min(100, barOf(r, max))}%`, height: '100%', borderRadius: 3, bgcolor: 'primary.main' }} />
                </Box>
              </Box>
            ))}
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * "Popular services" (share of bookings) and "Branch summary" (bookings + utilization).
 */
export function DashboardSideLists({ services, branches }: { services: DashboardNamedCount[]; branches: DashboardNamedCount[] }) {
  const { t } = useTranslation('dashboard');
  return (
    <>
      <RankedList title={t('popular_services', 'บริการยอดนิยม')} rows={services} emptyText={t('empty_range', 'ไม่มีข้อมูลในช่วงนี้')} pctSuffix="" barOf={(r, max) => (r.count / max) * 100} />
      <RankedList title={t('branch_summary', 'สรุปสาขา')} rows={branches} emptyText={t('empty_range', 'ไม่มีข้อมูลในช่วงนี้')} pctSuffix={t('utilization_short', 'หนาแน่น')} barOf={(r) => r.pct} />
    </>
  );
}
