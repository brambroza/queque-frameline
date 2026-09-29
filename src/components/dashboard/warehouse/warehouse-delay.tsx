'use client';

import { Box, Stack, Tooltip, Typography } from '@mui/material';
import { useTranslation } from '@/lib/i18n/useTranslation';
import { share } from '@/lib/dashboard/warehouse-kpi';
import type { DashboardWarehouse } from '@/types/dashboard';
import { hourLabel, longThaiDate, shortThaiDate, weekdayName, weekdayOfISO } from '../dashboard-utils';
import { Panel, Swatch, WAREHOUSE_COLORS } from './warehouse-ui';

const PLOT_HEIGHT = 160;

/** Round the axis top up to a friendly step. */
function axis(peak: number): { top: number; step: number } {
  const step = peak <= 4 ? 1 : peak <= 10 ? 2 : peak <= 20 ? 5 : peak <= 50 ? 10 : 20;
  return { top: Math.max(step, Math.ceil(peak / step) * step), step };
}

/** Late queues by who caused them, plus the trend per day (per booked hour for one day). */
export function WarehouseDelay({ warehouse }: { warehouse: DashboardWarehouse }) {
  const { t } = useTranslation('dashboard');
  const k = warehouse.kpi;
  const { mode, points } = warehouse.trend;
  const unit = t('queue_unit', 'คิว');
  const byWarehouse = t('wh_by_warehouse', 'คลังเริ่มช้า');
  const byTruck = t('wh_by_truck', 'รถมาสาย');
  const { top, step } = axis(points.reduce((m, p) => Math.max(m, p.by_warehouse + p.by_truck), 0));
  const ticks = Array.from({ length: top / step }, (_, i) => (i + 1) * step);
  const sparse = points.length > 14;

  const stats = [
    { name: byWarehouse, value: k.by_warehouse, color: WAREHOUSE_COLORS.byWarehouse },
    { name: byTruck, value: k.by_truck, color: WAREHOUSE_COLORS.byTruck },
    { name: t('wh_overrun', 'เกินแผน'), value: k.overrun, color: undefined },
  ];

  return (
    <Panel title={t('wh_delay', 'ความล่าช้า')}>
      <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', sm: 'repeat(3,1fr)' } }}>
        {stats.map((s) => (
          <Box key={s.name} sx={{ bgcolor: 'action.hover', borderRadius: 1.5, px: 1.5, py: 1 }}>
            <Typography sx={{ fontSize: 24, fontWeight: 700, lineHeight: 1.2 }}>
              {s.value} <Typography component="span" variant="caption" color="text.secondary">{unit} · {share(s.value, k.closed)}%</Typography>
            </Typography>
            <Typography variant="body2" color="text.secondary">{s.color ? <Swatch color={s.color} /> : null}{s.name}</Typography>
          </Box>
        ))}
      </Box>

      <Box sx={{ position: 'relative', height: PLOT_HEIGHT, ml: 3.5, mt: 2.5, borderBottom: 1, borderColor: 'divider' }}>
        {ticks.map((v) => (
          <Box key={v} sx={{ position: 'absolute', left: 0, right: 0, bottom: `${(v / top) * 100}%`, borderTop: '1px dashed', borderColor: 'divider' }}>
            <Typography variant="caption" color="text.secondary" sx={{ position: 'absolute', left: -28, top: -9, width: 22, textAlign: 'right', fontSize: 11 }}>{v}</Typography>
          </Box>
        ))}
        <Stack direction="row" alignItems="flex-end" sx={{ position: 'absolute', inset: 0, gap: '2px' }}>
          {points.map((p) => {
            const label = mode === 'hour' ? hourLabel(Number(p.key)) : `${weekdayName(t, weekdayOfISO(p.key))} ${longThaiDate(p.key)}`;
            return (
              <Tooltip key={p.key} arrow title={<>{label}<br />{byWarehouse} {p.by_warehouse}<br />{byTruck} {p.by_truck}</>}>
                <Stack tabIndex={0} justifyContent="flex-end" alignItems="center" sx={{ flex: '1 1 0', minWidth: 0, height: '100%', gap: '2px' }}>
                  {p.by_truck ? <Box data-grow="y" sx={{ width: 'min(100%, 22px)', height: `${(p.by_truck / top) * 100}%`, bgcolor: WAREHOUSE_COLORS.byTruck, borderRadius: '4px 4px 0 0', transformOrigin: 'center bottom' }} /> : null}
                  {p.by_warehouse ? <Box data-grow="y" sx={{ width: 'min(100%, 22px)', height: `${(p.by_warehouse / top) * 100}%`, bgcolor: WAREHOUSE_COLORS.byWarehouse, borderRadius: p.by_truck ? 0 : '4px 4px 0 0', transformOrigin: 'center bottom' }} /> : null}
                </Stack>
              </Tooltip>
            );
          })}
        </Stack>
      </Box>
      <Stack direction="row" sx={{ ml: 3.5, mt: 0.5, gap: '2px' }}>
        {points.map((p, i) => (
          <Typography key={p.key} variant="caption" color="text.secondary" sx={{ flex: '1 1 0', minWidth: 0, textAlign: 'center', fontSize: 10.5, whiteSpace: 'nowrap' }}>
            {mode === 'hour' ? p.key.padStart(2, '0') : sparse ? (i % 5 === 0 ? shortThaiDate(p.key) : '') : shortThaiDate(p.key)}
          </Typography>
        ))}
      </Stack>
    </Panel>
  );
}
