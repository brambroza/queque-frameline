'use client';

import { Box, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import { useTranslation } from '@/lib/i18n/useTranslation';
import type { DashboardWarehouse } from '@/types/dashboard';
import { shortThaiDate } from '../dashboard-utils';
import { BarRow, Panel, Swatch, WAREHOUSE_COLORS } from './warehouse-ui';

/** The queues that started latest against their booking. */
export function WarehouseLateQueues({ warehouse }: { warehouse: DashboardWarehouse }) {
  const { t } = useTranslation('dashboard');
  const min = t('unit_minute', 'นาที');
  const many = warehouse.branches.length > 1;

  return (
    <Panel title={t('wh_late_queues', 'คิวที่ช้าที่สุด')}>
      {warehouse.late_queues.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>{t('wh_no_late', 'ไม่มีคิวล่าช้า')}</Typography>
      ) : (
        <Box sx={{ overflowX: 'auto' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{t('queue', 'คิว')}</TableCell>
                <TableCell>{t('date_time', 'วันที่ · เวลา')}</TableCell>
                <TableCell>{t('wh_dock', 'ท่า')}</TableCell>
                <TableCell>{t('wh_cause', 'สาเหตุ')}</TableCell>
                <TableCell align="right">{t('wh_late_by', 'ช้า')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {warehouse.late_queues.map((q) => (
                <TableRow key={q.id} data-pop hover>
                  <TableCell sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{q.queue_number}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{shortThaiDate(q.booking_date)} {q.start_time}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{many ? `${q.branch_name} · ` : ''}{q.dock_name}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>
                    <Swatch color={q.cause === 'warehouse' ? WAREHOUSE_COLORS.byWarehouse : WAREHOUSE_COLORS.byTruck} />
                    {q.cause === 'warehouse' ? t('wh_by_warehouse', 'คลังเริ่มช้า') : t('wh_by_truck', 'รถมาสาย')}
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{q.late_min} {min}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      )}
    </Panel>
  );
}

/** Partners whose trucks check in late most often. */
export function WarehouseLatePartners({ warehouse }: { warehouse: DashboardWarehouse }) {
  const { t } = useTranslation('dashboard');

  return (
    <Panel title={t('wh_late_partners', 'คู่ค้าที่มาสายบ่อย')}>
      {warehouse.late_partners.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>{t('empty_range', 'ไม่มีข้อมูลในช่วงนี้')}</Typography>
      ) : (
        <Stack spacing={1.5}>
          {warehouse.late_partners.map((p) => (
            <BarRow key={p.customer_id} name={p.name} figures={<><b>{p.pct}%</b> · {p.late}/{p.trips}</>} pct={p.pct} color={WAREHOUSE_COLORS.byTruck} />
          ))}
        </Stack>
      )}
    </Panel>
  );
}
