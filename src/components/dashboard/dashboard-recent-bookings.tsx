'use client';

import { useEffect, useState } from 'react';
import { Box, Card, CardContent, Chip, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import { StatusChip } from '@/components/shared/status-chip';
import { TablePaginationControls } from '@/components/ui/table-pagination-controls';
import { useTranslation } from '@/lib/i18n/useTranslation';
import { formatDateTimeDMY } from '@/lib/utils/date-format';
import { formatMinutes, queueDuration } from '@/lib/dashboard/queue-duration';
import type { DashboardData, DashboardRecentBooking } from '@/types/dashboard';
import { shortThaiDate } from './dashboard-utils';

/**
 * "47 นาที" for a closed queue, a live "กำลังทำ · 12 นาที" chip while it is
 * called or being served, "–" otherwise. Counted from the call to the close.
 */
function DurationCell({ booking, now }: { booking: DashboardRecentBooking; now: number }) {
  const { t } = useTranslation('dashboard');
  const unit = { minute: t('unit_minute', 'นาที'), hour: t('unit_hour', 'ชม.') };
  const d = queueDuration(booking, now);
  if (d.kind === 'none') return <Typography component="span" variant="body2" color="text.disabled">–</Typography>;
  const recalled = booking.call_count > 1 ? ` · ${t('called_times', 'เรียก')} ${booking.call_count} ${t('times_unit', 'ครั้ง')}` : '';
  if (d.kind === 'running') return <Chip size="small" color="info" variant="outlined" label={`${t('in_progress', 'กำลังทำ')} · ${formatMinutes(d.minutes, unit)}`} />;
  return (
    <Typography component="span" variant="body2" fontWeight={600}>
      {formatMinutes(d.minutes, unit)}
      {recalled ? <Typography component="span" variant="caption" color="text.secondary">{recalled}</Typography> : null}
    </Typography>
  );
}

/**
 * Bookings created most recently whose booking date falls inside the selected range.
 * Pagination is server-side (`recent_page` / `recent_limit`).
 */
export function DashboardRecentBookings({ data, onPageChange, onLimitChange }: { data: DashboardData; onPageChange: (page: number) => void; onLimitChange: (limit: number) => void }) {
  const { t } = useTranslation('dashboard');
  const { rows, total, page, limit } = data.recent_bookings;
  const avg = data.kpi.avg_queue_minutes;

  // Re-render once a minute so queues still running show a current figure.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);
  useEffect(() => setNow(Date.now()), [data]);

  return (
    <Card>
      <CardContent>
        <Typography fontWeight={700}>{t('queue_list', 'รายการคิว')}</Typography>
        <Typography variant="caption" color="text.secondary" display="block" mb={1}>
          {total} {t('items_unit', 'รายการ')}
          {avg != null ? ` · ${t('avg_short', 'เฉลี่ย')} ${formatMinutes(avg, { minute: t('unit_minute', 'นาที'), hour: t('unit_hour', 'ชม.') })}` : ''}
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
                <TableCell sx={{ whiteSpace: 'nowrap' }}>{t('queue_minutes_short', 'ใช้เวลา')}</TableCell>
                <TableCell>{t('booked_at', 'จองเมื่อ')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8}>
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
                    <TableCell sx={{ whiteSpace: 'nowrap' }}><DurationCell booking={b} now={now} /></TableCell>
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
