'use client';

import { Box, Stack, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { longThaiDate } from '@/components/dashboard/dashboard-utils';
import { useTranslation } from '@/lib/i18n/useTranslation';
import { getStatusMeta } from '@/lib/booking/status-meta';
import type { ReportData, ReportNamedCount } from '@/types/reports';
import { DocBar, DocMuted, DocSection, DocSubTitle, DocTable, DOC_FONT, type DocColumn } from './report-doc-primitives';
import { ReportKpiSummary } from './report-kpi-row';
import { ReportTrendChart } from './report-trend-chart';
import { ReportStaffTable } from './report-staff-table';
import { ReportBookingsTable } from './report-bookings-table';
import { formatGeneratedAt, reportRangeLabel } from './report-utils';

type SectionKey = 'figures' | 'charts' | 'breakdown' | 'bookings';

/** Queue sheets (today / upcoming) put the booking list first. */
const ORDER_QUEUE: SectionKey[] = ['bookings', 'figures', 'charts', 'breakdown'];
const ORDER_ANALYSIS: SectionKey[] = ['figures', 'charts', 'breakdown', 'bookings'];

/**
 * The report itself, laid out as a document: header → sections → footer.
 * Rendered on screen inside a paper card and again (with `print`) into the
 * print portal. Screen and print carry the same sections in the same order;
 * `print` only fixes the two-column grids (A4 is narrower than the `md`
 * breakpoint) and expands the booking list.
 */
export function ReportDocument({ data, print = false }: { data: ReportData; print?: boolean }) {
  const { t } = useTranslation('reports');
  const { t: ts } = useTranslation('status');
  const theme = useTheme();
  const queueSheet = data.range.from >= data.range.today;
  const singleDay = data.range.from === data.range.to;
  const rangeText = reportRangeLabel(t, data.range.preset, data.range.from, data.range.to);

  const statusRows = data.by_status.map((s) => ({ ...s, pct: data.kpi.total ? Math.round((s.count / data.kpi.total) * 100) : 0 }));
  const statusColor = (status: string) => {
    const key = getStatusMeta(status).palette;
    return key === 'default' ? theme.palette.text.disabled : theme.palette[key].main;
  };

  const namedColumns = (unit: string, pctLabel: string): DocColumn<ReportNamedCount>[] => [
    { key: 'name', label: t('col_name', 'ชื่อ'), render: (r) => r.name },
    { key: 'count', label: unit, align: 'right', render: (r) => <b>{r.count}</b> },
    { key: 'pct', label: pctLabel, align: 'right', width: 64, render: (r) => `${r.pct}%` },
    { key: 'bar', label: '', width: '28%', render: (r) => <DocBar pct={r.pct} /> },
  ];

  const prevHint = data.prev ? `${t('vs_prev_period', 'เทียบช่วงก่อนหน้า')} ${longThaiDate(data.prev.from)} – ${longThaiDate(data.prev.to)}` : undefined;

  /** Section body by key; sections carry no heading, only an optional hint caption. */
  const renderSection = (key: SectionKey) => {
    switch (key) {
      case 'figures':
        return (
          <DocSection key={key} hint={prevHint}>
            <ReportKpiSummary data={data} />
          </DocSection>
        );
      case 'charts':
        return (
          <DocSection key={key} hint={singleDay ? t('trend_hourly_hint', '') : t('trend_daily_hint', 'เสร็จสิ้น / ยังใช้งาน / ยกเลิก+ไม่มา')}>
            <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: print ? '3fr 2fr' : { xs: '1fr', md: '3fr 2fr' }, alignItems: 'start' }}>
              <ReportTrendChart data={data} print={print} bare />
              <Box>
                <DocSubTitle>{t('status_title', 'สถานะคิว')}</DocSubTitle>
                {statusRows.length === 0 ? (
                  <DocMuted>{t('empty_range', 'ไม่มีข้อมูลในช่วงนี้')}</DocMuted>
                ) : (
                  <Stack spacing={0.75}>
                    {statusRows.map((s) => (
                      <Box key={s.status}>
                        <Stack direction="row" justifyContent="space-between" alignItems="baseline">
                          <Stack direction="row" spacing={0.75} alignItems="center">
                            <Box sx={{ width: 9, height: 9, borderRadius: 0.5, bgcolor: statusColor(s.status) }} />
                            <Typography sx={{ fontSize: DOC_FONT.body }}>{ts(s.status, s.status)}</Typography>
                          </Stack>
                          <Typography sx={{ fontSize: DOC_FONT.body, fontWeight: 600 }}>
                            {s.count} <Box component="span" sx={{ color: 'text.secondary', fontWeight: 400, fontSize: DOC_FONT.small }}>({s.pct}%)</Box>
                          </Typography>
                        </Stack>
                        <Box sx={{ mt: 0.4 }}><DocBar pct={s.pct} color={statusColor(s.status)} /></Box>
                      </Box>
                    ))}
                  </Stack>
                )}
              </Box>
            </Box>
          </DocSection>
        );
      case 'breakdown':
        return (
          <DocSection key={key}>
            <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: print ? (data.by_branch.length > 1 ? '1fr 1fr' : '1fr') : { xs: '1fr', md: data.by_branch.length > 1 ? '1fr 1fr' : '1fr' }, mb: 2 }}>
              <Box>
                <DocSubTitle>{t('services_title', 'บริการยอดนิยม')}</DocSubTitle>
                <DocTable columns={namedColumns(t('queue_unit', 'คิว'), t('col_share', 'สัดส่วน'))} rows={data.popular_services.slice(0, 10)} rowKey={(r) => r.name} emptyText={t('empty_range', 'ไม่มีข้อมูลในช่วงนี้')} />
              </Box>
              {data.by_branch.length > 1 ? (
                <Box>
                  <DocSubTitle>{t('branches_title', 'สรุปตามสาขา')}</DocSubTitle>
                  <DocTable columns={namedColumns(t('queue_unit', 'คิว'), t('col_share', 'สัดส่วน'))} rows={data.by_branch} rowKey={(r) => r.name} emptyText={t('empty_range', 'ไม่มีข้อมูลในช่วงนี้')} />
                </Box>
              ) : null}
            </Box>
            <DocSubTitle>{t('staff_title', 'รายผู้ให้บริการ / ทรัพยากร')}</DocSubTitle>
            <ReportStaffTable rows={data.by_staff} />
          </DocSection>
        );
      case 'bookings':
        return (
          <DocSection key={key} hint={`${data.bookings.total} ${t('items_unit', 'รายการ')} · ${t('bookings_hint', 'เรียงตามวันที่และเวลาเริ่ม')}`} avoidBreak={false}>
            <ReportBookingsTable data={data} print={print} />
          </DocSection>
        );
    }
  };

  const order = queueSheet ? ORDER_QUEUE : ORDER_ANALYSIS;

  return (
    <Box sx={{ fontFamily: 'var(--font-sans), sans-serif', color: 'text.primary' }}>
      {/* ── Header ── */}
      <Stack direction="row" alignItems="flex-start" spacing={2} sx={{ borderBottom: '3px solid', borderColor: 'text.primary', pb: 1.5 }}>
        {data.shop.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={data.shop.logo_url} alt="" width={52} height={52} style={{ borderRadius: 10, objectFit: 'cover', flexShrink: 0 }} />
        ) : null}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: DOC_FONT.small, color: 'text.secondary', fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase' }}>
            {queueSheet ? t('print_title_queue', 'ใบรายการคิว') : t('print_title_analysis', 'รายงานสรุปคิว')}
          </Typography>
          <Typography component="h1" sx={{ fontSize: 22, fontWeight: 800, lineHeight: 1.2 }}>{data.shop.name || '-'}</Typography>
          <Typography sx={{ fontSize: DOC_FONT.body, color: 'text.secondary' }}>
            {data.branch.name ? `${t('col_branch', 'สาขา')} ${data.branch.name}` : t('all_branches', 'ทุกสาขา')}
          </Typography>
        </Box>
        <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
          <Typography sx={{ fontSize: DOC_FONT.small, color: 'text.secondary' }}>{t('report_period', 'ช่วงรายงาน')}</Typography>
          <Typography sx={{ fontSize: 14, fontWeight: 700 }}>{rangeText}</Typography>
          <Typography sx={{ fontSize: DOC_FONT.caption, color: 'text.secondary', mt: 0.5 }}>{t('generated_at', 'ออกรายงานเมื่อ')} {formatGeneratedAt(data.generated_at)}</Typography>
        </Box>
      </Stack>

      {order.map((key) => renderSection(key))}

      {/* ── Footer ── */}
      <Box sx={{ mt: 3, pt: 1, borderTop: '1px solid', borderColor: 'divider', display: 'flex', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
        <DocMuted>{data.shop.name} · {rangeText}</DocMuted>
        <DocMuted>{t('generated_at', 'ออกรายงานเมื่อ')} {formatGeneratedAt(data.generated_at)}</DocMuted>
      </Box>
    </Box>
  );
}
