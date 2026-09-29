'use client';

import { Box, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import { useTranslation } from '@/lib/i18n/useTranslation';
import type { DashboardWarehouse } from '@/types/dashboard';
import { Bar, Panel } from './warehouse-ui';

/** The same KPIs side by side per branch. Shown only when more than one branch is in view. */
export function WarehouseBranchCompare({ warehouse }: { warehouse: DashboardWarehouse }) {
  const { t } = useTranslation('dashboard');
  const min = t('unit_minute', 'นาที');
  if (warehouse.branches.length < 2) return null;

  return (
    <Panel title={t('wh_branches', 'เปรียบเทียบสาขา')}>
      <Box sx={{ overflowX: 'auto' }}>
        <Table size="small" sx={{ minWidth: 640 }}>
          <TableHead>
            <TableRow>
              <TableCell>{t('branch', 'สาขา')}</TableCell>
              <TableCell align="right">{t('completed', 'เสร็จสิ้น')}</TableCell>
              <TableCell align="right">{t('wh_dock_time', 'เวลาที่ท่า')}</TableCell>
              <TableCell align="right">{t('wh_turnaround', 'เวลารวมในคลัง')}</TableCell>
              <TableCell align="right">{t('wh_late', 'คิวล่าช้า')}</TableCell>
              <TableCell align="right">{t('wh_dock_use', 'การใช้ท่า')}</TableCell>
              <TableCell sx={{ minWidth: 160 }}>{t('wh_on_time', 'ตรงเวลา')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {warehouse.branches.map((b) => (
              <TableRow key={b.branch_id} data-pop hover>
                <TableCell><Typography variant="body2" fontWeight={600}>{b.name}</Typography></TableCell>
                <TableCell align="right">{b.closed}</TableCell>
                <TableCell align="right">{b.dock_avg} {min}</TableCell>
                <TableCell align="right">{b.turnaround_avg} {min}</TableCell>
                <TableCell align="right">{b.late}</TableCell>
                <TableCell align="right">{b.dock_utilization_pct}%</TableCell>
                <TableCell>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Box sx={{ flex: 1, '& > div': { mt: 0 } }}><Bar pct={b.on_time_pct} /></Box>
                    <Typography variant="body2" fontWeight={600} sx={{ width: 40, textAlign: 'right' }}>{b.on_time_pct}%</Typography>
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>
    </Panel>
  );
}
