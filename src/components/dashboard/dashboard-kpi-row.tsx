'use client';

import { Box } from '@mui/material';
import EventNoteRoundedIcon from '@mui/icons-material/EventNoteRounded';
import SpeedRoundedIcon from '@mui/icons-material/SpeedRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import CancelRoundedIcon from '@mui/icons-material/CancelRounded';
import PeopleRoundedIcon from '@mui/icons-material/PeopleRounded';
import RoomServiceRoundedIcon from '@mui/icons-material/RoomServiceRounded';
import { DashboardCard } from '@/components/shared/dashboard-card';
import { useTranslation } from '@/lib/i18n/useTranslation';
import type { DashboardData } from '@/types/dashboard';
import { fmt, utilizationTone, weekdayName, weekdayOfISO } from './dashboard-utils';

/** "▲ 12%" / "▼ 5%" / "—" versus the previous period. */
function deltaText(cur: number, prev: number): string {
  if (prev === 0 && cur === 0) return '—';
  if (prev === 0) return '▲ new';
  const p = Math.round(((cur - prev) / prev) * 100);
  return p === 0 ? '• 0%' : `${p > 0 ? '▲' : '▼'} ${Math.abs(p)}%`;
}

function pointsText(cur: number, prev: number, unit: string): string {
  const p = cur - prev;
  return p === 0 ? `• 0 ${unit}` : `${p > 0 ? '▲' : '▼'} ${Math.abs(p)} ${unit}`;
}

/**
 * KPI tiles for the selected range. Every tile carries a comparison hint against
 * the previous period returned by the API; the "serving now" tile only appears
 * for the `today` range.
 */
export function DashboardKpiRow({ data }: { data: DashboardData }) {
  const { t } = useTranslation('dashboard');
  const { kpi, range } = data;
  const isToday = range.kind === 'today';

  const prevLabel = isToday
    ? fmt(t('vs_last_weekday', 'เทียบ{{weekday}}ก่อน'), { weekday: weekdayName(t, weekdayOfISO(range.today)) })
    : range.kind === 'week'
      ? t('vs_prev_week', 'เทียบสัปดาห์ก่อน')
      : range.kind === 'month'
        ? t('vs_prev_month', 'เทียบเดือนก่อน')
        : fmt(t('vs_prev_days', 'เทียบ {{days}} วันก่อนหน้า'), { days: range.days });

  const cancelNow = kpi.cancelled + kpi.no_show;
  const cancelPct = kpi.total > 0 ? Math.round((cancelNow / kpi.total) * 100) : 0;
  const prevCancelPct = kpi.prev.total > 0 ? Math.round(((kpi.prev.cancelled + kpi.prev.no_show) / kpi.prev.total) * 100) : 0;
  const customersTotal = kpi.customers_new + kpi.customers_returning;
  const returningPct = customersTotal > 0 ? Math.round((kpi.customers_returning / customersTotal) * 100) : 0;
  const pts = t('points', 'จุด');

  const columns = isToday ? 6 : 5;

  return (
    <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: 'repeat(2,1fr)', sm: 'repeat(3,1fr)', lg: `repeat(${columns},1fr)` } }}>
      <DashboardCard label={t('bookings_total', 'คิวทั้งหมด')} value={kpi.booked} tone="primary" icon={<EventNoteRoundedIcon />} hint={`${deltaText(kpi.booked, kpi.prev.booked)} ${prevLabel}`} />
      <DashboardCard
        label={t('utilization', 'ความหนาแน่น')}
        value={`${kpi.utilization_pct}%`}
        tone={utilizationTone(kpi.utilization_pct)}
        icon={<SpeedRoundedIcon />}
        hint={`${kpi.booked}/${kpi.capacity} slot · ${pointsText(kpi.utilization_pct, kpi.prev.utilization_pct, pts)}`}
      />
      <DashboardCard label={t('completed', 'เสร็จสิ้น')} value={kpi.completed} tone="success" icon={<CheckCircleRoundedIcon />} hint={`${deltaText(kpi.completed, kpi.prev.completed)} ${prevLabel}`} />
      <DashboardCard
        label={t('cancel_noshow', 'ยกเลิก + ไม่มา')}
        value={cancelNow}
        tone="error"
        icon={<CancelRoundedIcon />}
        hint={`${cancelPct}% ${t('of_bookings', 'ของคิว')} · ${pointsText(cancelPct, prevCancelPct, pts)}`}
      />
      <DashboardCard
        label={t('customers_new_returning', 'ลูกค้าใหม่ / กลับมาซ้ำ')}
        value={`${kpi.customers_new} / ${kpi.customers_returning}`}
        tone="default"
        icon={<PeopleRoundedIcon />}
        hint={`${t('returning_rate', 'กลับมาซ้ำ')} ${returningPct}%`}
      />
      {isToday ? (
        <DashboardCard label={t('serving_now', 'กำลังให้บริการ')} value={kpi.serving} tone="info" icon={<RoomServiceRoundedIcon />} hint={`${t('waiting_now', 'รอเรียก')} ${kpi.waiting} ${t('queue_unit', 'คิว')}`} />
      ) : null}
    </Box>
  );
}
