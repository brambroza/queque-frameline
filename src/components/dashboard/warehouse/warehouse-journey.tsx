'use client';

import { Box, Stack, Tooltip, Typography } from '@mui/material';
import { useTranslation } from '@/lib/i18n/useTranslation';
import type { DashboardWarehouse } from '@/types/dashboard';
import { Panel, WAREHOUSE_COLORS } from './warehouse-ui';

/** Where a truck's time goes: yard wait, response to the call, time on the dock. */
export function WarehouseJourney({ warehouse }: { warehouse: DashboardWarehouse }) {
  const { t } = useTranslation('dashboard');
  const k = warehouse.kpi;
  const min = t('unit_minute', 'นาที');
  const legs = [
    { name: t('wh_leg_yard', 'รอในลาน'), value: k.yard_avg, color: WAREHOUSE_COLORS.yard },
    { name: t('wh_leg_response', 'ตอบรับการเรียก'), value: k.response_avg, color: WAREHOUSE_COLORS.response },
    { name: t('wh_leg_dock', 'ขึ้น/ลงของ'), value: k.dock_avg, color: WAREHOUSE_COLORS.dock },
  ];

  return (
    <Panel title={t('wh_journey', 'เวลาของรถ 1 คัน')} action={<Typography variant="body2" color="text.secondary">{t('wh_total', 'รวม')} <b>{k.turnaround_avg}</b> {min}</Typography>}>
      <Stack direction="row" sx={{ height: 36, gap: '2px' }}>
        {legs.map((leg) => (
          <Tooltip key={leg.name} title={`${leg.name} ${leg.value} ${min}`} arrow>
            <Box data-grow="x" tabIndex={0} sx={{ flex: `${Math.max(leg.value, 0.5)} 1 0`, minWidth: 6, bgcolor: leg.color, borderRadius: 1, transformOrigin: 'left center' }} />
          </Tooltip>
        ))}
      </Stack>
      <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', sm: 'repeat(3,1fr)' }, mt: 1.5 }}>
        {legs.map((leg) => (
          <Box key={leg.name} sx={{ borderLeft: `3px solid ${leg.color}`, pl: 1.25 }}>
            <Typography sx={{ fontSize: 22, fontWeight: 700, lineHeight: 1.2 }}>{leg.value} <Typography component="span" variant="caption" color="text.secondary">{min}</Typography></Typography>
            <Typography variant="body2" color="text.secondary">{leg.name}</Typography>
          </Box>
        ))}
      </Box>
    </Panel>
  );
}
