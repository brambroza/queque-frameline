'use client';

import { useState } from 'react';
import { Box, Button, Typography } from '@mui/material';
import { shortThaiDate } from '@/components/dashboard/dashboard-utils';
import { useTranslation } from '@/lib/i18n/useTranslation';
import type { ReportBookingRow, ReportData } from '@/types/reports';
import { DocMuted, DocTable, type DocColumn } from './report-doc-primitives';

/** Rows shown on screen before the "show all" button. Print always shows everything. */
const PREVIEW_ROWS = 50;

/**
 * Every booking in the range, ordered by date and start time. Queue sheets
 * (ranges starting today or later) add a blank note column for hand-written
 * remarks at the counter.
 */
export function ReportBookingsTable({ data, print = false }: { data: ReportData; print?: boolean }) {
  const { t } = useTranslation('reports');
  const { t: ts } = useTranslation('status');
  const [showAll, setShowAll] = useState(false);
  const { rows, total, truncated } = data.bookings;
  const singleDay = data.range.from === data.range.to;
  const queueSheet = data.range.from >= data.range.today;

  const visible = print || showAll ? rows : rows.slice(0, PREVIEW_ROWS);

  const columns: DocColumn<ReportBookingRow>[] = [
    {
      key: 'time',
      label: singleDay ? t('col_time', 'เวลา') : t('col_date_time', 'วันที่ · เวลา'),
      render: (b) => (
        <Box component="span" sx={{ whiteSpace: 'nowrap' }}>
          {singleDay ? null : <b>{shortThaiDate(b.booking_date)} </b>}
          {b.start_time}{b.end_time ? `–${b.end_time}` : ''}
        </Box>
      ),
    },
    { key: 'queue', label: t('col_queue', 'คิว'), render: (b) => <b>{b.queue_number}</b> },
    { key: 'customer', label: t('col_customer', 'ลูกค้า'), render: (b) => b.customer_name },
    { key: 'phone', label: t('col_phone', 'โทร'), render: (b) => <Box component="span" sx={{ whiteSpace: 'nowrap', color: 'text.secondary' }}>{b.customer_phone || '-'}</Box> },
    { key: 'service', label: t('col_service', 'บริการ'), render: (b) => b.service_name },
    { key: 'staff', label: t('col_staff', 'ผู้ให้บริการ'), render: (b) => b.resource_name || '-' },
    { key: 'status', label: t('col_status', 'สถานะ'), render: (b) => <Box component="span" sx={{ whiteSpace: 'nowrap' }}>{ts(b.status, b.status)}</Box> },
  ];
  if (data.by_branch.length > 1) columns.splice(6, 0, { key: 'branch', label: t('col_branch', 'สาขา'), render: (b) => <Box component="span" sx={{ color: 'text.secondary' }}>{b.branch_name}</Box> });
  if (queueSheet) columns.push({ key: 'note', label: t('col_note', 'หมายเหตุ'), width: print ? 90 : 140, render: (b) => b.note });

  return (
    <Box>
      {truncated ? <Typography sx={{ fontSize: 11, color: 'warning.main', mb: 0.5 }}>{t('bookings_truncated', 'แสดงเฉพาะ 1,000 รายการแรก — เลือกช่วงให้แคบลงหรือ Export CSV')}</Typography> : null}
      <DocTable columns={columns} rows={visible} rowKey={(b) => b.id} emptyText={t('empty_range', 'ไม่มีข้อมูลในช่วงนี้')} />
      {!print && rows.length > PREVIEW_ROWS ? (
        <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <DocMuted>{showAll ? `${rows.length} / ${total}` : `${visible.length} / ${total}`} {t('items_unit', 'รายการ')}</DocMuted>
          <Button size="small" onClick={() => setShowAll((v) => !v)}>{showAll ? t('show_less', 'แสดงเฉพาะ 50 รายการแรก') : t('show_all', 'แสดงทั้งหมด')}</Button>
        </Box>
      ) : null}
    </Box>
  );
}
