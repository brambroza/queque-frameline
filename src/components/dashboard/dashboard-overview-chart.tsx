'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Card, CardContent, Stack, ToggleButton, ToggleButtonGroup, Tooltip, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { useTranslation } from '@/lib/i18n/useTranslation';
import type { DashboardData } from '@/types/dashboard';
import { hourLabel, longThaiDate, shortThaiDate, weekdayName, weekdayOfISO } from './dashboard-utils';

export type OverviewView = 'density' | 'timeline';

type Bar = { key: string; label: string; full: string; count: number; capacity: number; holiday: boolean; highlight: boolean };

/** Bucket utilization for heatmap / bar colouring. */
function utilizationLevel(count: number, capacity: number): 'closed' | 'empty' | 1 | 2 | 3 | 4 | 5 | 'over' {
  if (capacity <= 0) return 'closed';
  const u = count / capacity;
  if (u === 0) return 'empty';
  if (u > 1) return 'over';
  if (u >= 0.85) return 5;
  if (u >= 0.65) return 4;
  if (u >= 0.45) return 3;
  if (u >= 0.25) return 2;
  return 1;
}

/**
 * Main overview card with two views of the same range:
 * - density  — bars of bookings per day (per hour for `today`) against a dashed capacity line
 * - timeline — heatmap of date × hour (weekday × hour for ranges longer than 14 days)
 */
export function DashboardOverviewChart({ data, view, onViewChange, nowHour }: { data: DashboardData; view: OverviewView; onViewChange: (v: OverviewView) => void; nowHour: number }) {
  const { t } = useTranslation('dashboard');
  const isToday = data.range.kind === 'today';

  return (
    <Card>
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" useFlexGap gap={1} mb={1.5}>
          <Box>
            <Typography fontWeight={700}>{t('overview', 'ภาพรวม')}</Typography>
            <Typography variant="caption" color="text.secondary">
              {isToday ? t('overview_hint_today', 'จำนวนคิวรายชั่วโมงเทียบความจุ · กรอบเขียว = ชั่วโมงปัจจุบัน') : `${t('overview_hint_range', 'จำนวนคิวรายวันเทียบความจุ')} · ${data.range.days} ${t('days_unit', 'วัน')}`}
            </Typography>
          </Box>
          <ToggleButtonGroup size="small" exclusive value={view} onChange={(_, v: OverviewView | null) => v && onViewChange(v)} aria-label={t('overview_view', 'มุมมอง')}>
            <ToggleButton value="density">{t('view_density', 'ความหนาแน่น')}</ToggleButton>
            <ToggleButton value="timeline">{t('view_timeline', 'ช่วงเวลา')}</ToggleButton>
          </ToggleButtonGroup>
        </Stack>
        {view === 'density' ? <DensityChart data={data} nowHour={nowHour} /> : <TimelineHeatmap data={data} nowHour={nowHour} />}
      </CardContent>
    </Card>
  );
}

function DensityChart({ data, nowHour }: { data: DashboardData; nowHour: number }) {
  const { t } = useTranslation('dashboard');
  const theme = useTheme();
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(800);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setWidth(Math.max(320, Math.floor(w)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const isToday = data.range.kind === 'today';
  const bars: Bar[] = useMemo(
    () =>
      isToday
        ? data.by_hour.map((h) => ({ key: String(h.hour), label: hourLabel(h.hour), full: `${hourLabel(h.hour)}–${hourLabel(h.hour + 1)}`, count: h.count, capacity: h.capacity, holiday: false, highlight: h.hour === nowHour }))
        : data.by_day.map((d) => ({
            key: d.date,
            label: String(Number(d.date.slice(8, 10))),
            full: `${weekdayName(t, weekdayOfISO(d.date))} ${longThaiDate(d.date)}`,
            count: d.count,
            capacity: d.capacity,
            holiday: d.is_holiday,
            highlight: d.date === data.range.today,
          })),
    [data, isToday, nowHour, t],
  );

  const colors = {
    low: theme.palette.mode === 'dark' ? alpha(theme.palette.primary.main, 0.45) : alpha(theme.palette.primary.main, 0.35),
    normal: theme.palette.primary.main,
    high: theme.palette.primary.dark,
    over: theme.palette.error.main,
    holiday: alpha(theme.palette.text.primary, 0.08),
    grid: theme.palette.divider,
    text: theme.palette.text.secondary,
    muted: theme.palette.text.disabled,
    accent: theme.palette.primary.main,
    accentText: theme.palette.primary.dark,
  };

  if (bars.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ py: 6, textAlign: 'center' }}>
        {t('empty_range', 'ไม่มีข้อมูลในช่วงนี้')}
      </Typography>
    );
  }

  const H = 260;
  const padL = 34;
  const padR = 8;
  const padT = 18;
  const padB = 28;
  const n = bars.length;
  const maxV = Math.max(1, ...bars.map((b) => Math.max(b.count, b.capacity)));
  const cw = (width - padL - padR) / n;
  const bw = Math.min(28, cw * 0.62);
  const y = (v: number) => padT + (H - padT - padB) * (1 - v / maxV);
  const labelStep = n > 20 ? Math.ceil(n / 15) : 1;
  const ticks = 4;
  const capacityPath = bars.map((b, i) => `${i ? 'L' : 'M'}${padL + i * cw} ${y(b.capacity)} L${padL + (i + 1) * cw} ${y(b.capacity)}`).join(' ');

  const legend: Array<{ color: string; label: string; dashed?: boolean }> = [
    { color: colors.low, label: t('legend_low', 'ว่างมาก (<40%)') },
    { color: colors.normal, label: t('legend_normal', 'ปกติ') },
    { color: colors.high, label: t('legend_high', 'แน่น (>85%)') },
    { color: colors.over, label: t('legend_over', 'เกินความจุ') },
    { color: colors.text, label: t('capacity', 'ความจุ'), dashed: true },
    { color: colors.holiday, label: t('holiday', 'วันหยุด') },
  ];

  return (
    <Box>
      <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap mb={1}>
        {legend.map((l) => (
          <Stack key={l.label} direction="row" spacing={0.6} alignItems="center">
            <Box sx={{ width: l.dashed ? 16 : 12, height: l.dashed ? 0 : 12, borderRadius: 0.75, bgcolor: l.dashed ? 'transparent' : l.color, borderTop: l.dashed ? `2px dashed ${l.color}` : 'none' }} />
            <Typography variant="caption" color="text.secondary">{l.label}</Typography>
          </Stack>
        ))}
      </Stack>
      <Box ref={wrapRef} sx={{ position: 'relative', width: '100%' }}>
        <svg viewBox={`0 0 ${width} ${H}`} width="100%" height={H} role="img" aria-label={isToday ? t('overview_hint_today', 'จำนวนคิวรายชั่วโมงเทียบความจุ') : t('overview_hint_range', 'จำนวนคิวรายวันเทียบความจุ')} style={{ display: 'block', overflow: 'visible' }}>
          {Array.from({ length: ticks + 1 }, (_, i) => {
            const v = Math.round((maxV * i) / ticks);
            return (
              <g key={i}>
                <line x1={padL} x2={width - padR} y1={y(v)} y2={y(v)} stroke={colors.grid} strokeWidth={1} />
                <text x={padL - 6} y={y(v) + 4} textAnchor="end" fontSize={11} fill={colors.muted}>{v}</text>
              </g>
            );
          })}
          <path d={capacityPath} fill="none" stroke={colors.text} strokeWidth={1.5} strokeDasharray="4 3" />
          {bars.map((b, i) => {
            const cx = padL + i * cw + cw / 2;
            const u = b.capacity ? b.count / b.capacity : 0;
            const fill = u > 1 ? colors.over : u > 0.85 ? colors.high : u < 0.4 ? colors.low : colors.normal;
            const h = Math.max(b.count ? 4 : 0, y(0) - y(b.count));
            const tip = b.holiday ? `${b.full} · ${t('holiday_closed', 'วันหยุด — ปิดร้าน')}` : `${b.full} · ${t('booked', 'จอง')} ${b.count} / ${t('capacity', 'ความจุ')} ${b.capacity} (${Math.round(u * 100)}%)`;
            return (
              <g key={b.key}>
                {b.holiday ? <rect x={padL + i * cw + 2} y={padT} width={Math.max(0, cw - 4)} height={H - padT - padB} fill={colors.holiday} rx={4} /> : null}
                {!b.holiday && h > 0 ? <rect x={cx - bw / 2} y={y(0) - h} width={bw} height={h} fill={fill} rx={4} /> : null}
                {!b.holiday && n <= 16 && b.capacity > 0 ? (
                  <text x={cx} y={y(b.count) - 6} textAnchor="middle" fontSize={11} fontWeight={600} fill={colors.text}>{Math.round(u * 100)}%</text>
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

function TimelineHeatmap({ data, nowHour }: { data: DashboardData; nowHour: number }) {
  const { t } = useTranslation('dashboard');
  const theme = useTheme();
  const { heatmap } = data;
  const isWeekday = heatmap.mode === 'weekday';
  const primary = theme.palette.primary.main;

  const levelStyle = (level: ReturnType<typeof utilizationLevel>) => {
    switch (level) {
      case 'closed':
        return { background: `repeating-linear-gradient(135deg, ${alpha(theme.palette.text.primary, 0.05)} 0 4px, ${alpha(theme.palette.text.primary, 0.1)} 4px 6px)`, color: 'transparent' };
      case 'empty':
        return { bgcolor: 'action.hover', color: 'text.disabled' };
      case 1:
        return { bgcolor: alpha(primary, 0.16), color: 'text.primary' };
      case 2:
        return { bgcolor: alpha(primary, 0.32), color: 'text.primary' };
      case 3:
        return { bgcolor: alpha(primary, 0.55), color: 'common.white' };
      case 4:
        return { bgcolor: primary, color: 'common.white' };
      case 5:
        return { bgcolor: theme.palette.primary.dark, color: 'common.white' };
      case 'over':
        return { bgcolor: 'error.main', color: 'common.white' };
    }
  };

  if (heatmap.rows.length === 0 || heatmap.hours.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ py: 6, textAlign: 'center' }}>
        {heatmap.hours.length === 0 ? t('no_working_hours', 'ยังไม่ได้ตั้งเวลาทำการ จึงคำนวณความจุไม่ได้') : t('empty_range', 'ไม่มีข้อมูลในช่วงนี้')}
      </Typography>
    );
  }

  const rowLabel = (key: string) => {
    if (isWeekday) return weekdayName(t, Number(key));
    return `${weekdayName(t, weekdayOfISO(key)).slice(0, 2)} ${shortThaiDate(key)}`;
  };

  return (
    <Box>
      <Box sx={{ overflowX: 'auto' }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: `auto repeat(${heatmap.hours.length}, minmax(40px, 1fr))`, gap: '3px', minWidth: 560 }}>
          <Box />
          {heatmap.hours.map((h) => (
            <Typography key={h} variant="caption" color="text.secondary" textAlign="center">{String(h).padStart(2, '0')}</Typography>
          ))}
          {heatmap.rows.map((row) => {
            const isTodayRow = !isWeekday && row.key === data.range.today;
            return (
              <Box key={row.key} sx={{ display: 'contents' }}>
                <Typography variant="caption" sx={{ pr: 1, whiteSpace: 'nowrap', alignSelf: 'center', textAlign: 'right', color: isTodayRow ? 'primary.dark' : 'text.secondary', fontWeight: isTodayRow ? 700 : 400 }}>
                  {rowLabel(row.key)}
                </Typography>
                {row.cells.map((c) => {
                  const level = utilizationLevel(c.count, c.capacity);
                  const pctText = c.capacity > 0 ? `${Math.round((c.count / c.capacity) * 100)}%` : '';
                  const title = level === 'closed' ? `${rowLabel(row.key)} ${hourLabel(c.hour)} · ${t('closed', 'ปิด')}` : `${rowLabel(row.key)} ${hourLabel(c.hour)} · ${c.count}/${c.capacity} (${pctText})`;
                  const isNow = isTodayRow && data.range.kind === 'today' && c.hour === nowHour;
                  const href = isWeekday ? undefined : `/portal/bookings?date=${row.key}`;
                  const cell = (
                    <Box
                      component={href ? 'a' : 'div'}
                      href={href}
                      sx={{
                        height: 30,
                        borderRadius: 1.25,
                        display: 'grid',
                        placeItems: 'center',
                        fontSize: 11.5,
                        fontWeight: 600,
                        textDecoration: 'none',
                        cursor: level === 'closed' ? 'default' : href ? 'pointer' : 'default',
                        outline: isNow ? `2px solid ${primary}` : 'none',
                        outlineOffset: 1,
                        ...levelStyle(level),
                        '&:hover': level === 'closed' ? {} : { filter: 'brightness(0.93)' },
                      }}
                      aria-label={title}
                    >
                      {level === 'closed' ? '' : isWeekday ? String(c.count).replace(/\.0$/, '') : c.count}
                    </Box>
                  );
                  return (
                    <Tooltip key={`${row.key}-${c.hour}`} title={title} arrow>
                      {cell}
                    </Tooltip>
                  );
                })}
              </Box>
            );
          })}
        </Box>
      </Box>
      <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap mt={1.25}>
        <Typography variant="caption" color="text.secondary">{t('legend_less', 'น้อย')}</Typography>
        {[1, 2, 3, 4, 5].map((lv) => (
          <Box key={lv} sx={{ width: 18, height: 12, borderRadius: 0.75, ...levelStyle(lv as 1 | 2 | 3 | 4 | 5) }} />
        ))}
        <Typography variant="caption" color="text.secondary">{t('legend_full', 'เต็ม')}</Typography>
        <Box sx={{ width: 18, height: 12, borderRadius: 0.75, ml: 1, bgcolor: 'error.main' }} />
        <Typography variant="caption" color="text.secondary">{t('legend_over', 'เกินความจุ')}</Typography>
        <Box sx={{ width: 18, height: 12, borderRadius: 0.75, ml: 1, ...levelStyle('closed') }} />
        <Typography variant="caption" color="text.secondary">{t('legend_closed', 'ปิด/วันหยุด')}</Typography>
        {!isWeekday ? (
          <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>{t('heatmap_click_hint', 'คลิกช่องเพื่อเปิดรายการคิววันนั้น')}</Typography>
        ) : (
          <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>{t('heatmap_weekday_hint', 'ค่าเฉลี่ยต่อวันในสัปดาห์ (ช่วงเกิน 14 วัน)')}</Typography>
        )}
      </Stack>
    </Box>
  );
}
