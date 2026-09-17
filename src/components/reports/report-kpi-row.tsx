'use client';

import { Box, Typography } from '@mui/material';
import { useTranslation } from '@/lib/i18n/useTranslation';
import type { ReportData } from '@/types/reports';
import { DOC_FONT } from './report-doc-primitives';

/** "▲ 12%" / "▼ 5%" / "—" versus a previous value. */
function delta(cur: number, prev: number | undefined): string {
  if (prev === undefined) return '';
  if (prev === 0 && cur === 0) return '—';
  if (prev === 0) return '▲ new';
  const p = Math.round(((cur - prev) / prev) * 100);
  return p === 0 ? '• 0%' : `${p > 0 ? '▲' : '▼'} ${Math.abs(p)}%`;
}

/**
 * Key-figure strip for the report document: a ruled row of numbers with the
 * previous-period change beneath each, not dashboard tiles.
 */
export function ReportKpiSummary({ data }: { data: ReportData }) {
  const { t } = useTranslation('reports');
  const { kpi, prev } = data;
  const customers = kpi.customers_new + kpi.customers_returning;
  const items: Array<{ label: string; value: string | number; sub?: string }> = [
    { label: t('kpi_total', 'คิวทั้งหมด'), value: kpi.total, sub: prev ? `${delta(kpi.total, prev.total)} ${t('vs_prev', 'เทียบช่วงก่อน')}` : `${t('kpi_active', 'ยังใช้งาน')} ${kpi.booked}` },
    { label: t('kpi_completed', 'เสร็จสิ้น'), value: kpi.completed, sub: prev ? `${delta(kpi.completed, prev.completed)} ${t('vs_prev', 'เทียบช่วงก่อน')}` : t('kpi_not_yet', 'ยังไม่ถึงกำหนด') },
    { label: t('kpi_cancelled', 'ยกเลิก'), value: kpi.cancelled, sub: prev ? `${delta(kpi.cancelled, prev.cancelled)} ${t('vs_prev', 'เทียบช่วงก่อน')}` : undefined },
    { label: t('kpi_no_show', 'ไม่มาตามนัด'), value: kpi.no_show, sub: prev ? `${delta(kpi.no_show, prev.no_show)} ${t('vs_prev', 'เทียบช่วงก่อน')}` : undefined },
    { label: t('kpi_cancel_rate', 'ยกเลิก + ไม่มา'), value: `${kpi.cancel_rate}%`, sub: t('of_bookings', 'ของคิว') },
    { label: t('kpi_customers', 'ลูกค้าใหม่ / กลับมาซ้ำ'), value: `${kpi.customers_new} / ${kpi.customers_returning}`, sub: customers ? `${t('returning_rate', 'กลับมาซ้ำ')} ${Math.round((kpi.customers_returning / customers) * 100)}%` : undefined },
  ];

  return (
    // Phones: 2 columns with wrapping labels; sm+ (and print, A4 > sm): the original 6-column strip.
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(6, 1fr)' }, border: '1px solid', borderColor: 'divider', borderRadius: 1.5, overflow: 'hidden' }}>
      {items.map((it, i) => (
        <Box
          key={it.label}
          sx={{
            p: 1.25,
            borderLeft: { xs: i % 2 === 0 ? 'none' : '1px solid', sm: i % 6 === 0 ? 'none' : '1px solid' },
            borderColor: 'divider',
            borderTop: { xs: i >= 2 ? '1px solid' : 'none', sm: 'none' },
            borderTopColor: 'divider',
          }}
        >
          <Typography sx={{ fontSize: DOC_FONT.caption, color: 'text.secondary', fontWeight: 600, whiteSpace: { xs: 'normal', sm: 'nowrap' } }} noWrap>{it.label}</Typography>
          <Typography sx={{ fontSize: { xs: 20, sm: 22 }, fontWeight: 800, lineHeight: 1.15, color: 'text.primary' }}>{it.value}</Typography>
          {it.sub ? <Typography sx={{ fontSize: DOC_FONT.caption, color: 'text.secondary', whiteSpace: { xs: 'normal', sm: 'nowrap' } }} noWrap>{it.sub}</Typography> : null}
        </Box>
      ))}
    </Box>
  );
}
