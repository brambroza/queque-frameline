'use client';

import { Box, Card, CardContent, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import { StatusChip } from '@/components/shared/status-chip';
import { TablePaginationControls } from '@/components/ui/table-pagination-controls';
import { useTranslation } from '@/lib/i18n/useTranslation';
import { formatDateTimeDMY } from '@/lib/utils/date-format';
import type { DashboardData } from '@/types/dashboard';
import { rangeLabel, shortThaiDate } from './dashboard-utils';

/**
 * Bookings created most recently whose booking date falls inside the selected range.
 * Pagination is server-side (`recent_page` / `recent_limit`).
 */
export function DashboardRecentBookings({ data, onPageChange, onLimitChange }: { data: DashboardData; onPageChange: (page: number) => void; onLimitChange: (limit: number) => void }) {
  const { t } = useTranslation('dashboard');
  const { rows, total, page, limit } = data.recent_bookings;

  return (
    <Card>
      <CardContent>
        <Typography fontWeight={700}>{t('recent_bookings', 'การจองล่าสุด')}</Typography>
        <Typography variant="caption" color="text.secondary" display="block" mb={1}>
          {t('recent_hint', 'จองเข้ามาล่าสุดในช่วง')} {rangeLabel(t, data.range.kind, data.range.from, data.range.to)} · {total} {t('items_unit', 'รายการ')}
        </Typography>
        <Box sx={{ overflowX: 'auto' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{t('date_time', 'วันที่ · เวลา')}</TableCell>
                <TableCell>{t('queue', 'คิว')}</TableCell>
                <TableCell>{t('customer', 'ลูกค้า')}</TableCell>
                <TableCell>{t('service', 'บริการ')}</TableCell>
                <TableCell>{t('branch', 'สาขา')}</TableCell>
                <TableCell>{t('status', 'สถานะ')}</TableCell>
                <TableCell>{t('booked_at', 'จองเมื่อ')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7}>
                    <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>{t('empty_range', 'ไม่มีข้อมูลในช่วงนี้')}</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((b) => (
                  <TableRow key={b.id} hover>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      <Typography component="span" variant="body2" fontWeight={600}>{shortThaiDate(b.booking_date)}</Typography>{' '}
                      <Typography component="span" variant="body2" color="text.secondary">{b.start_time}</Typography>
                    </TableCell>
                    <TableCell>{b.queue_number}</TableCell>
                    <TableCell>{b.customer_name}</TableCell>
                    <TableCell>{b.service_name}</TableCell>
                    <TableCell sx={{ color: 'text.secondary' }}>{b.branch_name}</TableCell>
                    <TableCell><StatusChip status={b.status} /></TableCell>
                    <TableCell sx={{ color: 'text.secondary', whiteSpace: 'nowrap' }}>{formatDateTimeDMY(b.created_at)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Box>
        <Box sx={{ mt: 1 }}>
          <TablePaginationControls page={page} rowsPerPage={limit} total={total} rowsPerPageOptions={[10, 20, 50]} onPageChange={onPageChange} onRowsPerPageChange={onLimitChange} />
        </Box>
      </CardContent>
    </Card>
  );
}
