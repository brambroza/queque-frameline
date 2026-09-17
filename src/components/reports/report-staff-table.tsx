'use client';

import { useTranslation } from '@/lib/i18n/useTranslation';
import type { ReportStaffStat } from '@/types/reports';
import { DocTable, type DocColumn } from './report-doc-primitives';

/**
 * Per-resource tally (trainer / stylist / table …) with a totals row.
 * Bookings without a resource are grouped under the API's "ไม่ระบุ" label.
 */
export function ReportStaffTable({ rows }: { rows: ReportStaffStat[] }) {
  const { t } = useTranslation('reports');
  const sum = rows.reduce((a, r) => ({ count: a.count + r.count, completed: a.completed + r.completed, cancelled: a.cancelled + r.cancelled, no_show: a.no_show + r.no_show }), { count: 0, completed: 0, cancelled: 0, no_show: 0 });
  const columns: DocColumn<ReportStaffStat>[] = [
    { key: 'name', label: t('col_name', 'ชื่อ'), render: (r) => r.name },
    { key: 'count', label: t('col_total', 'คิวทั้งหมด'), align: 'right', render: (r) => <b>{r.count}</b> },
    { key: 'completed', label: t('col_completed', 'เสร็จสิ้น'), align: 'right', render: (r) => r.completed },
    { key: 'cancelled', label: t('col_cancelled', 'ยกเลิก'), align: 'right', render: (r) => r.cancelled },
    { key: 'no_show', label: t('col_no_show', 'ไม่มาตามนัด'), align: 'right', render: (r) => r.no_show },
    { key: 'rate', label: t('col_completed_rate', 'สำเร็จ %'), align: 'right', render: (r) => (r.count ? `${Math.round((r.completed / r.count) * 100)}%` : '-') },
  ];
  return (
    <DocTable
      columns={columns}
      rows={rows}
      rowKey={(r) => r.name}
      emptyText={t('empty_range', 'ไม่มีข้อมูลในช่วงนี้')}
      footer={[t('row_total', 'รวม'), sum.count, sum.completed, sum.cancelled, sum.no_show, sum.count ? `${Math.round((sum.completed / sum.count) * 100)}%` : '-']}
    />
  );
}
