'use client';

import { Box, Card, CardContent, Stack, Typography } from '@mui/material';
import { useTranslation } from '@/lib/i18n/useTranslation';
import type { DashboardWarehouse } from '@/types/dashboard';
import { CountUp, Delta } from './warehouse-ui';

type Tile = { label: string; value: number; decimals?: number; unit: string; prev: number; deltaUnit: string; lowerIsBetter?: boolean };

/** Secondary KPIs: on-time rate, turnaround, SLA, throughput, dock use, no-shows. */
export function WarehouseTiles({ warehouse }: { warehouse: DashboardWarehouse }) {
  const { t } = useTranslation('dashboard');
  const k = warehouse.kpi;
  const pts = t('points', 'จุด');
  const min = t('unit_minute', 'นาที');

  const tiles: Tile[] = [
    { label: t('wh_on_time', 'ตรงเวลา'), value: k.on_time_pct, unit: '%', prev: k.prev.on_time_pct, deltaUnit: pts },
    { label: t('wh_turnaround', 'เวลารวมในคลัง'), value: k.turnaround_avg, unit: min, prev: k.prev.turnaround_avg, deltaUnit: min, lowerIsBetter: true },
    { label: `SLA ${warehouse.thresholds.sla_turnaround_min} ${min}`, value: k.sla_pct, unit: '%', prev: k.prev.sla_pct, deltaUnit: pts },
    { label: t('wh_throughput', 'ปริมาณงาน'), value: k.per_day, decimals: 1, unit: t('wh_per_day', 'คัน/วัน'), prev: k.prev.per_day, deltaUnit: '' },
    { label: t('wh_dock_use', 'การใช้ท่า'), value: k.dock_utilization_pct, unit: '%', prev: k.prev.dock_utilization_pct, deltaUnit: pts },
    { label: t('no_show', 'ไม่มา'), value: k.no_show_pct, unit: '%', prev: k.prev.no_show_pct, deltaUnit: pts, lowerIsBetter: true },
  ];

  return (
    <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: 'repeat(2,1fr)', sm: 'repeat(3,1fr)', lg: 'repeat(6,1fr)' } }}>
      {tiles.map((tile) => (
        <Card key={tile.label} data-pop sx={{ minWidth: 0 }}>
          <CardContent sx={{ '&:last-child': { pb: 2 } }}>
            <Typography variant="caption" color="text.secondary" noWrap display="block">{tile.label}</Typography>
            <Stack direction="row" alignItems="baseline" spacing={0.5}>
              <Typography sx={{ fontSize: 28, fontWeight: 800, lineHeight: 1.2, fontVariantNumeric: 'tabular-nums' }}><CountUp value={tile.value} decimals={tile.decimals} /></Typography>
              <Typography variant="caption" color="text.secondary">{tile.unit}</Typography>
            </Stack>
            <Delta now={tile.value} prev={tile.prev} unit={tile.deltaUnit} lowerIsBetter={tile.lowerIsBetter} />
          </CardContent>
        </Card>
      ))}
    </Box>
  );
}
