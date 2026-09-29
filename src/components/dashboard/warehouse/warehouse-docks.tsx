'use client';

import { Chip, Stack, Typography } from '@mui/material';
import { useTranslation } from '@/lib/i18n/useTranslation';
import type { DashboardWarehouse } from '@/types/dashboard';
import { BarRow, Panel, WAREHOUSE_COLORS } from './warehouse-ui';

/** Dock use at or above this share of open time is flagged as nearly full. */
const NEARLY_FULL_PCT = 80;
/** Dock use below this share of open time is flagged as mostly idle. */
const MOSTLY_IDLE_PCT = 35;

/** Per dock: share of open time in use, trucks served, dock time, yard wait. */
export function WarehouseDocks({ warehouse }: { warehouse: DashboardWarehouse }) {
  const { t } = useTranslation('dashboard');
  const min = t('unit_minute', 'นาที');
  const many = warehouse.branches.length > 1;

  return (
    <Panel title={t('wh_docks', 'การใช้งานท่า')}>
      {warehouse.docks.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>{t('empty_range', 'ไม่มีข้อมูลในช่วงนี้')}</Typography>
      ) : (
        <Stack spacing={1.5}>
          {warehouse.docks.map((d) => (
            <BarRow
              key={d.id}
              name={
                <>
                  {many && d.branch_name ? `${d.branch_name} · ` : ''}{d.name}
                  {d.utilization_pct >= NEARLY_FULL_PCT ? <Chip size="small" color="error" variant="outlined" label={t('wh_nearly_full', 'ใกล้เต็ม')} sx={{ ml: 1, height: 20 }} /> : null}
                  {d.count > 0 && d.utilization_pct < MOSTLY_IDLE_PCT ? <Chip size="small" color="warning" variant="outlined" label={t('wh_idle', 'ว่างมาก')} sx={{ ml: 1, height: 20 }} /> : null}
                </>
              }
              figures={<><b>{d.utilization_pct}%</b> · {d.count} {t('wh_trucks', 'คัน')} · {d.avg_dock_min} {min} · {t('wh_wait', 'รอ')} {d.avg_wait_min}</>}
              pct={d.utilization_pct}
            />
          ))}
        </Stack>
      )}
    </Panel>
  );
}

/** Per vehicle type: actual dock time as a bar, the plan as a tick. */
export function WarehouseVehicles({ warehouse }: { warehouse: DashboardWarehouse }) {
  const { t } = useTranslation('dashboard');
  const min = t('unit_minute', 'นาที');
  const tolerance = warehouse.thresholds.overrun_tolerance_min;
  const max = warehouse.vehicles.reduce((m, v) => Math.max(m, v.avg_min, v.plan_min), 0) * 1.1 || 1;

  return (
    <Panel title={t('wh_vehicles', 'เวลาตามประเภทรถ')}>
      {warehouse.vehicles.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>{t('empty_range', 'ไม่มีข้อมูลในช่วงนี้')}</Typography>
      ) : (
        <Stack spacing={1.5}>
          {warehouse.vehicles.map((v) => {
            const over = v.plan_min > 0 && v.avg_min - v.plan_min > tolerance;
            return (
              <BarRow
                key={v.service_id}
                name={<>{v.name}{over ? <Chip size="small" color="error" variant="outlined" label={`+${v.avg_min - v.plan_min} ${min}`} sx={{ ml: 1, height: 20 }} /> : null}</>}
                figures={<><b>{v.avg_min}</b> / {v.plan_min || '–'} {min} · {v.count} {t('wh_trucks', 'คัน')}</>}
                pct={(v.avg_min / max) * 100}
                color={over ? WAREHOUSE_COLORS.bad : 'primary.main'}
                marker={v.plan_min > 0 ? (v.plan_min / max) * 100 : undefined}
              />
            );
          })}
        </Stack>
      )}
    </Panel>
  );
}
