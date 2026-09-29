'use client';

import { Box, Card, CardContent, Stack, Typography } from '@mui/material';
import { useTranslation } from '@/lib/i18n/useTranslation';
import type { DashboardWarehouse } from '@/types/dashboard';
import { CountUp, Delta, Swatch, WAREHOUSE_COLORS } from './warehouse-ui';

function Hero({ label, value, unit, children }: { label: string; value: number; unit: string; children: React.ReactNode }) {
  return (
    <Card data-pop sx={{ minWidth: 0 }}>
      <CardContent>
        <Typography variant="body2" color="text.secondary">{label}</Typography>
        <Stack direction="row" alignItems="baseline" spacing={1} flexWrap="wrap" useFlexGap>
          <Typography sx={{ fontSize: { xs: 48, sm: 64 }, fontWeight: 800, lineHeight: 1.05, fontVariantNumeric: 'tabular-nums' }}><CountUp value={value} /></Typography>
          <Typography color="text.secondary">{unit}</Typography>
        </Stack>
        {children}
      </CardContent>
    </Card>
  );
}

/** The two headline answers: minutes on the dock per truck, and queues that started late. */
export function WarehouseHeroes({ warehouse }: { warehouse: DashboardWarehouse }) {
  const { t } = useTranslation('dashboard');
  const k = warehouse.kpi;
  const min = t('unit_minute', 'นาที');
  const whPct = k.late ? (k.by_warehouse / k.late) * 100 : 0;

  return (
    <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
      <Hero label={t('wh_dock_time', 'เวลาที่ท่า')} value={k.dock_avg} unit={t('wh_min_per_truck', 'นาที/คัน')}>
        <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap mt={0.5}>
          <Typography variant="body2" color="text.secondary">{t('wh_median', 'ค่ากลาง')} <b>{k.dock_median}</b></Typography>
          <Typography variant="body2" color="text.secondary">P90 <b>{k.dock_p90}</b></Typography>
          <Typography variant="body2" color="text.secondary">{t('wh_plan', 'แผน')} <b>{k.plan_avg}</b></Typography>
          <Delta now={k.dock_avg} prev={k.prev.dock_avg} unit={min} lowerIsBetter />
        </Stack>
      </Hero>
      <Hero label={t('wh_late', 'คิวล่าช้า')} value={k.late} unit={`/ ${k.closed.toLocaleString('th-TH')} · ${k.late_pct}%`}>
        <Stack direction="row" sx={{ height: 8, gap: '2px', mt: 1 }}>
          <Box data-grow="x" sx={{ width: `${k.late ? Math.max(2, whPct) : 50}%`, bgcolor: k.late ? WAREHOUSE_COLORS.byWarehouse : 'action.hover', borderRadius: 1, transformOrigin: 'left center' }} />
          <Box data-grow="x" sx={{ flex: 1, bgcolor: k.late ? WAREHOUSE_COLORS.byTruck : 'action.hover', borderRadius: 1, transformOrigin: 'left center' }} />
        </Stack>
        <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap mt={0.75}>
          <Typography variant="body2" color="text.secondary"><Swatch color={WAREHOUSE_COLORS.byWarehouse} />{t('wh_by_warehouse', 'คลังเริ่มช้า')} <b>{k.by_warehouse}</b></Typography>
          <Typography variant="body2" color="text.secondary"><Swatch color={WAREHOUSE_COLORS.byTruck} />{t('wh_by_truck', 'รถมาสาย')} <b>{k.by_truck}</b></Typography>
          <Delta now={k.late} prev={k.prev.late} unit={t('queue_unit', 'คิว')} lowerIsBetter />
        </Stack>
      </Hero>
    </Box>
  );
}
