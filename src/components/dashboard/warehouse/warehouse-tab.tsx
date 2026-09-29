'use client';

import { useRef } from 'react';
import { Alert, Box, Stack, Typography } from '@mui/material';
import { useTranslation } from '@/lib/i18n/useTranslation';
import type { DashboardData } from '@/types/dashboard';
import { fmt } from '../dashboard-utils';
import { useDashboardMotion } from './use-dashboard-motion';
import { WarehouseBottleneck } from './warehouse-bottleneck';
import { WarehouseBranchCompare } from './warehouse-branch-compare';
import { WarehouseDelay } from './warehouse-delay';
import { WarehouseDocks, WarehouseVehicles } from './warehouse-docks';
import { WarehouseFloorStats } from './warehouse-floor-stats';
import { WarehouseHeroes } from './warehouse-heroes';
import { WarehouseJourney } from './warehouse-journey';
import { WarehouseLatePartners, WarehouseLateQueues } from './warehouse-late-lists';
import { WarehouseTiles } from './warehouse-tiles';

const TWO_COLUMNS = { display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, alignItems: 'start' };

/** Warehouse KPI tab: dock time and delay first, then where the time goes and who is affected. */
export function WarehouseTab({ data }: { data: DashboardData }) {
  const { t } = useTranslation('dashboard');
  const ref = useRef<HTMLDivElement | null>(null);
  const warehouse = data.warehouse;
  useDashboardMotion(ref, warehouse);

  if (!warehouse.available) return <Alert severity="error">{t('wh_load_failed', 'โหลด KPI คลังไม่สำเร็จ')}</Alert>;

  return (
    <Stack ref={ref} spacing={2}>
      <WarehouseHeroes warehouse={warehouse} />
      {warehouse.kpi.closed === 0 ? (
        <Alert severity="info">{t('wh_empty', 'ยังไม่มีคิวที่ปิดงานในช่วงนี้')}</Alert>
      ) : (
        <>
          <WarehouseTiles warehouse={warehouse} />
          <WarehouseJourney warehouse={warehouse} />
          <WarehouseDelay warehouse={warehouse} />
          <WarehouseBranchCompare warehouse={warehouse} />
          <Box sx={TWO_COLUMNS}>
            <WarehouseDocks warehouse={warehouse} />
            <WarehouseVehicles warehouse={warehouse} />
          </Box>
          <WarehouseBottleneck warehouse={warehouse} />
          <Box sx={TWO_COLUMNS}>
            <WarehouseLateQueues warehouse={warehouse} />
            <WarehouseLatePartners warehouse={warehouse} />
          </Box>
        </>
      )}
      <WarehouseFloorStats warehouse={warehouse} />
      {warehouse.kpi.incomplete > 0 ? (
        <Typography variant="caption" color="text.secondary">{fmt(t('wh_incomplete', 'ไม่นับ {{count}} คิวที่เวลาไม่ครบ'), { count: warehouse.kpi.incomplete })}</Typography>
      ) : null}
    </Stack>
  );
}
