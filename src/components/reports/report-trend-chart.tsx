'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Card, CardContent, Stack, Tooltip, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { hourLabel, longThaiDate, weekdayName, weekdayOfISO } from '@/components/dashboard/dashboard-utils';
import { useTranslation } from '@/lib/i18n/useTranslation';
import type { ReportData } from '@/types/reports';

type Bar = { key: string; label: string; full: string; total: number; completed: number; cancelled: number; highlight: boolean };

/**
 * Stacked bars of bookings per day (per hour for a single day): completed on
 * top of other active statuses, with cancelled + no-show in the error tone.
 * Pure SVG so it prints and works in both themes without a chart library.
 */
export function ReportTrendChart({ data, print = false, bare = false }: { data: ReportData; print?: boolean; /** Render only the plot (no card / title) for embedding in the document. */ bare?: boolean }) {
  const { t } = useTranslation('reports');
  const { t: td } = useTranslation('dashboard');
  const theme = useTheme();
  const wrapRef = useRef<HTMLDivElement | null>(null);
  // Print: the chart sits in the 3fr column of a 780px A4 sheet (~450px), so
  // size the viewBox to match and keep labels legible instead of scaled down.
  const [width, setWidth] = useState(print ? 450 : 800);

  useEffect(() => {
    if (print) return;
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setWidth(Math.max(320, Math.floor(w)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [print]);

  const singleDay = data.range.from === data.range.to;
  const bars: Bar[] = useMemo(
    () =>
      singleDay
        ? data.by_hour.map((h) => ({ key: String(h.hour), label: hourLabel(h.hour), full: `${hourLabel(h.hour)}–${hourLabel(h.hour + 1)}`, total: h.count, completed: 0, cancelled: 0, highlight: false }))
        : data.by_day.map((d) => ({
            key: d.date,
            label: String(Number(d.date.slice(8, 10))),
            full: `${weekdayName(td, weekdayOfISO(d.date))} ${longThaiDate(d.date)}`,
            total: d.count,
            completed: d.completed,
            cancelled: d.cancelled + d.no_show,
            highlight: d.date === data.range.today,
          })),
    [data, singleDay, td],
  );

  const colors = {
    active: theme.palette.primary.main,
    completed: theme.palette.success.main,
    cancelled: alpha(theme.palette.error.main, 0.75),
    grid: theme.palette.divider,
    text: theme.palette.text.secondary,
    muted: theme.palette.text.disabled,
    accent: theme.palette.primary.main,
    accentText: theme.palette.primary.dark,
  };

  const title = singleDay ? t('trend_hourly', 'จำนวนคิวรายชั่วโมง') : t('trend_daily', 'จำนวนคิวรายวัน');
  const hint = singleDay ? t('trend_hourly_hint', 'นับทุกสถานะตามเวลาเริ่มคิว') : `${t('trend_daily_hint', 'เสร็จสิ้น / ยังใช้งาน / ยกเลิก+ไม่มา')} · ${data.range.days} ${t('days_unit', 'วัน')}`;

  const body =
    bars.length === 0 || bars.every((b) => b.total === 0) ? (
      <Typography variant="body2" color="text.secondary" sx={{ py: 6, textAlign: 'center' }}>{t('empty_range', 'ไม่มีข้อมูลในช่วงนี้')}</Typography>
    ) : (
      <ChartSvg bars={bars} width={width} colors={colors} singleDay={singleDay} wrapRef={wrapRef} t={t} />
    );

  if (bare) return body;

  return (
    <Card>
      <CardContent>
        <Typography fontWeight={700}>{title}</Typography>
        <Typography variant="caption" color="text.secondary" display="block" mb={1.5}>{hint}</Typography>
        {body}
      </CardContent>
    </Card>
  );
}

function ChartSvg({
  bars,
  width,
  colors,
  singleDay,
  wrapRef,
  t,
}: {
  bars: Bar[];
  width: number;
  colors: Record<'active' | 'completed' | 'cancelled' | 'grid' | 'text' | 'muted' | 'accent' | 'accentText', string>;
  singleDay: boolean;
  wrapRef: React.RefObject<HTMLDivElement | null>;
  t: (key: string, fallback?: string) => string;
}) {
  const H = 220;
  const padL = 34;
  const padR = 8;
  const padT = 18;
  const padB = 28;
  const n = bars.length;
  const maxV = Math.max(1, ...bars.map((b) => b.total));
  const cw = (width - padL - padR) / n;
  const bw = Math.min(28, cw * 0.62);
  const y = (v: number) => padT + (H - padT - padB) * (1 - v / maxV);
  const labelStep = n > 20 ? Math.ceil(n / 15) : 1;
  const ticks = Math.min(4, maxV);

  const legend: Array<{ color: string; label: string }> = singleDay
    ? [{ color: colors.active, label: t('legend_total', 'คิวทั้งหมด') }]
    : [
        { color: colors.completed, label: t('legend_completed', 'เสร็จสิ้น') },
        { color: colors.active, label: t('legend_active', 'ยังใช้งาน') },
        { color: colors.cancelled, label: t('legend_cancelled', 'ยกเลิก + ไม่มา') },
      ];

  return (
    <Box>
      <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap mb={1}>
        {legend.map((l) => (
          <Stack key={l.label} direction="row" spacing={0.6} alignItems="center">
            <Box sx={{ width: 12, height: 12, borderRadius: 0.75, bgcolor: l.color }} />
            <Typography variant="caption" color="text.secondary">{l.label}</Typography>
          </Stack>
        ))}
      </Stack>
      <Box ref={wrapRef} sx={{ position: 'relative', width: '100%' }}>
        <svg viewBox={`0 0 ${width} ${H}`} width="100%" height={H} role="img" aria-label={singleDay ? t('trend_hourly', 'จำนวนคิวรายชั่วโมง') : t('trend_daily', 'จำนวนคิวรายวัน')} style={{ display: 'block', overflow: 'visible' }}>
          {Array.from({ length: ticks + 1 }, (_, i) => {
            const v = Math.round((maxV * i) / ticks);
            return (
              <g key={i}>
                <line x1={padL} x2={width - padR} y1={y(v)} y2={y(v)} stroke={colors.grid} strokeWidth={1} />
                <text x={padL - 6} y={y(v) + 4} textAnchor="end" fontSize={11} fill={colors.muted}>{v}</text>
              </g>
            );
          })}
          {bars.map((b, i) => {
            const cx = padL + i * cw + cw / 2;
            const active = Math.max(0, b.total - b.completed - b.cancelled);
            const segments = singleDay
              ? [{ v: b.total, color: colors.active }]
              : [
                  { v: b.completed, color: colors.completed },
                  { v: active, color: colors.active },
                  { v: b.cancelled, color: colors.cancelled },
                ];
            let acc = 0;
            const tip = singleDay
              ? `${b.full} · ${b.total} ${t('queue_unit', 'คิว')}`
              : `${b.full} · ${t('legend_total', 'คิวทั้งหมด')} ${b.total} · ${t('legend_completed', 'เสร็จสิ้น')} ${b.completed} · ${t('legend_cancelled', 'ยกเลิก + ไม่มา')} ${b.cancelled}`;
            return (
              <g key={b.key}>
                {segments.map((s, si) => {
                  if (s.v <= 0) return null;
                  const top = y(acc + s.v);
                  const h = y(acc) - top;
                  acc += s.v;
                  return <rect key={si} x={cx - bw / 2} y={top} width={bw} height={Math.max(h, 1)} fill={s.color} rx={si === segments.length - 1 || acc === b.total ? 3 : 0} />;
                })}
                {b.total > 0 && n <= 16 ? (
                  <text x={cx} y={y(b.total) - 6} textAnchor="middle" fontSize={11} fontWeight={600} fill={colors.text}>{b.total}</text>
                ) : null}
                {b.highlight ? <rect x={padL + i * cw + 1} y={padT - 4} width={Math.max(0, cw - 2)} height={H - padT - padB + 4} fill="none" stroke={colors.accent} strokeWidth={1.5} rx={6} /> : null}
                {i % labelStep === 0 || b.highlight ? (
                  <text x={cx} y={H - 8} textAnchor="middle" fontSize={11} fontWeight={b.highlight ? 700 : 400} fill={b.highlight ? colors.accentText : colors.text}>{b.label}</text>
                ) : null}
                <Tooltip title={tip} placement="top" arrow>
                  <rect x={padL + i * cw} y={padT} width={cw} height={H - padT - padB} fill="transparent" style={{ cursor: 'default' }} tabIndex={0} aria-label={tip} />
                </Tooltip>
              </g>
            );
          })}
        </svg>
      </Box>
    </Box>
  );
}
