'use client';

import { Box, Card, Typography } from '@mui/material';
import { useTranslation } from '@/lib/i18n/useTranslation';
import type { DashboardWarehouse } from '@/types/dashboard';
import { CountUp } from './warehouse-ui';

/** Counts from the dock floor: directions, re-calls, plate mismatches, queues held by payment. */
export function WarehouseFloorStats({ warehouse }: { warehouse: DashboardWarehouse }) {
  const { t } = useTranslation('dashboard');
  const f = warehouse.floor;
  const stats = [
    { label: t('direction_outbound', 'ขาออก (SO)'), value: f.outbound },
    { label: t('direction_inbound', 'ขาเข้า (PO)'), value: f.inbound },
    { label: t('wh_recalled', 'เรียกซ้ำ'), value: f.recalled },
    { label: t('wh_plate_mismatch', 'ทะเบียนไม่ตรง'), value: f.plate_mismatch },
    { label: t('wh_awaiting_payment', 'รอชำระเงิน'), value: f.awaiting_payment },
  ];

  return (
    <Card>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2,1fr)', sm: 'repeat(5,1fr)' } }}>
        {stats.map((s) => (
          <Box key={s.label} sx={{ px: 2, py: 1.5, borderRight: 1, borderBottom: { xs: 1, sm: 0 }, borderColor: 'divider', '&:last-of-type': { borderRight: 0 } }}>
            <Typography variant="caption" color="text.secondary" noWrap display="block">{s.label}</Typography>
            <Typography sx={{ fontSize: 22, fontWeight: 700, lineHeight: 1.25 }}><CountUp value={s.value} /></Typography>
          </Box>
        ))}
      </Box>
    </Card>
  );
}
