'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { Alert, Box, Button, Chip, Skeleton, Stack, ToggleButton, ToggleButtonGroup, Tooltip, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { computeDockDay, labelOfMinutes, minutesOfDay, type DockDay, type DockDayResponse } from '@/lib/booking/dock-day';
import { shortThaiDay } from './dock-slot-picker';

const BAR_HEIGHT = 56;
/** Minutes the "around this queue" view keeps in sight at least. */
const NEAR_MIN_SPAN = 240;
/** Windows shorter than this are shown faded: nothing useful fits. */
const TINY_WINDOW = 15;

type Zoom = 'near' | 'day';

/** Loads `/api/bookings/[id]/dock-day` and turns it into the pure `DockDay` picture. */
function useDockDay(bookingId: string) {
  const [data, setData] = useState<DockDayResponse | null>(null);
  const [error, setError] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const ctl = new AbortController();
    setData(null);
    setError(false);
    fetch(`/api/bookings/${bookingId}/dock-day`, { cache: 'no-store', signal: ctl.signal })
      .then(async (r) => {
        const j = (await r.json().catch(() => ({}))) as { data?: DockDayResponse };
        if (!r.ok || !j.data) throw new Error();
        setData(j.data);
      })
      .catch(() => { if (!ctl.signal.aborted) setError(true); });
    return () => ctl.abort();
  }, [bookingId, reload]);

  const day = useMemo<DockDay | null>(() => {
    if (!data?.dock) return null;
    return computeDockDay({
      start_time: data.self.start_time,
      buffer_minutes: data.self.buffer_minutes,
      others: data.others,
      open_time: data.hours?.open_time,
      close_time: data.hours?.close_time,
      break_start: data.hours?.break_start,
      break_end: data.hours?.break_end,
    });
  }, [data]);

  return { data, day, loading: !data && !error, error, retry: () => setReload((k) => k + 1) };
}

/** Bar bounds for the chosen zoom, in minutes of the day. */
function viewRange(day: DockDay, zoom: Zoom, minutes: number): { start: number; end: number } {
  if (zoom === 'day') return { start: day.viewOpen, end: day.viewClose };
  const end = day.startMin + (Number.isFinite(minutes) && minutes > 0 ? minutes : 60);
  let s = Math.max(day.viewOpen, Math.floor((day.startMin - 60) / 60) * 60);
  let e = Math.min(day.viewClose, Math.ceil((end + 90) / 60) * 60);
  if (e - s < NEAR_MIN_SPAN) e = Math.min(day.viewClose, s + NEAR_MIN_SPAN);
  if (e - s < NEAR_MIN_SPAN) s = Math.max(day.viewOpen, e - NEAR_MIN_SPAN);
  return { start: s, end: e };
}

/**
 * The dock's day under the minutes field: other queues as grey blocks, this
 * queue as a blue block that stretches with the typed minutes, a red line where
 * it must have ended, and the day's free windows as chips. Clicking the bar or
 * a window sets the minutes. Purely advisory — the RPC still decides.
 */
export function DockDayTimeline({ bookingId, minutes, onPick, onDay }: {
  bookingId: string;
  /** Minutes currently typed in the field (may be NaN while editing). */
  minutes: number;
  onPick: (minutes: number) => void;
  /** Reports the computed day so the dialog can gate its save button. */
  onDay?: (day: DockDay | null) => void;
}) {
  const theme = useTheme();
  const { data, day, loading, error, retry } = useDockDay(bookingId);
  const [zoom, setZoom] = useState<Zoom>('near');
  const barRef = useRef<HTMLDivElement | null>(null);
  const [barWidth, setBarWidth] = useState(400);

  useEffect(() => { onDay?.(day); }, [day, onDay]);

  useLayoutEffect(() => {
    const el = barRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver((entries) => { const w = entries[0]?.contentRect.width; if (w) setBarWidth(w); });
    ro.observe(el);
    return () => ro.disconnect();
  }, [loading, error]);

  if (error) return <Alert severity="error" action={<Button color="inherit" size="small" onClick={retry}>ลองใหม่</Button>}>โหลดตารางท่าไม่สำเร็จ — บันทึกได้ แต่ระบบจะตรวจการชนตอนบันทึก</Alert>;
  if (loading || !data) return <Skeleton variant="rounded" height={BAR_HEIGHT + 96} />;
  if (!data.dock || !day) return <Alert severity="info">คิวนี้ยังไม่ระบุท่า — ระบบจะกันเวลาตามท่าที่ได้รับตอนอนุมัติ</Alert>;

  const view = viewRange(day, zoom, minutes);
  const span = view.end - view.start;
  const x = (m: number) => `${((m - view.start) / span) * 100}%`;
  const widthPct = (s: number, e: number) => `${((e - s) / span) * 100}%`;
  /** Minutes that a label `px` wide takes on the bar at the current width. */
  const minutesForPx = (px: number) => (px / barWidth) * span;

  const valid = Number.isInteger(minutes) && minutes >= 5 && minutes <= 1440;
  const end = day.startMin + (valid ? minutes : 0);
  const over = valid && minutes > day.maxMinutes;
  const limit = day.mustEndBefore;
  const dockName = data.dock.name ?? 'ท่า';
  const nowMin = data.now.date === data.date ? minutesOfDay(data.now.time) : null;
  const tickStep = span <= 300 ? 30 : 60;
  const ticks: number[] = [];
  for (let t = Math.ceil(view.start / tickStep) * tickStep; t <= view.end; t += tickStep) ticks.push(t);

  const clip = (s: number, e: number) => ({ s: Math.max(s, view.start), e: Math.min(e, view.end) });

  const busyBg = theme.palette.grey[200];
  const hatch = `repeating-linear-gradient(135deg, transparent 0 3px, ${alpha(theme.palette.common.black, 0.1)} 3px 6px)`;
  const breakBg = `repeating-linear-gradient(135deg, ${theme.palette.grey[100]} 0 6px, ${theme.palette.grey[300]} 6px 12px)`;
  const blockSx = { position: 'absolute', top: 0, bottom: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, lineHeight: 1.25, whiteSpace: 'nowrap', overflow: 'hidden', pointerEvents: 'none', fontVariantNumeric: 'tabular-nums' } as const;

  const pickFromBar = (e: MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    if (!r.width) return;
    const m = view.start + ((e.clientX - r.left) / r.width) * span;
    const endMin = Math.round(m / 5) * 5;
    if (endMin > day.startMin) onPick(Math.min(1440, endMin - day.startMin));
  };

  // Markers under the bar: split left / right when they would overlap.
  const markersClose = valid && limit !== null && Math.abs(end - limit) < minutesForPx(110);
  const endMarkerLeft = markersClose && limit !== null && end <= limit;

  return (
    <Stack spacing={1.5}>
      <Stack spacing={0.75}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
          <Typography variant="subtitle2" fontWeight={700}>{dockName} · {shortThaiDay(data.date)}</Typography>
          <ToggleButtonGroup size="small" exclusive value={zoom} onChange={(_, v: Zoom | null) => { if (v) setZoom(v); }} sx={{ '& .MuiToggleButton-root': { py: 0.25, px: 1.25, fontSize: 12, textTransform: 'none' } }}>
            <ToggleButton value="near">รอบคิวนี้</ToggleButton>
            <ToggleButton value="day">ทั้งวัน</ToggleButton>
          </ToggleButtonGroup>
        </Stack>

        <Box sx={{ position: 'relative', height: 16, fontSize: 10.5, color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}>
          {ticks.map((t) => <Box key={t} component="span" sx={{ position: 'absolute', left: x(t), transform: 'translateX(-50%)' }}>{labelOfMinutes(t)}</Box>)}
        </Box>

        <Box
          ref={barRef}
          onClick={pickFromBar}
          title="แตะบนแถบเพื่อกำหนดเวลาสิ้นสุด"
          sx={{ position: 'relative', height: BAR_HEIGHT, borderRadius: 1, overflow: 'hidden', cursor: 'crosshair', bgcolor: alpha(theme.palette.success.main, 0.12), border: 1, borderColor: 'divider' }}
        >
          {ticks.filter((t) => t % 60 === 0 && t > view.start && t < view.end).map((t) => (
            <Box key={`g${t}`} sx={{ position: 'absolute', top: 0, bottom: 0, left: x(t), width: '1px', bgcolor: 'divider' }} />
          ))}

          {day.breakRange ? (() => { const c = clip(day.breakRange.start, day.breakRange.end); return c.e > c.s ? (
            <Box sx={{ ...blockSx, left: x(c.s), width: widthPct(c.s, c.e), background: breakBg, color: 'text.secondary' }}>
              พัก{(day.breakRange.end - day.breakRange.start) >= minutesForPx(78) ? <Box component="small" sx={{ fontWeight: 500, fontSize: 10 }}>{labelOfMinutes(day.breakRange.start)}–{labelOfMinutes(day.breakRange.end)}</Box> : null}
            </Box>
          ) : null; })() : null}

          {day.blocks.map((b) => {
            const c = clip(b.start, b.end);
            const buf = clip(b.end, b.bufferEnd);
            const wide = (b.end - b.start) >= minutesForPx(78);
            return (
              <Box key={b.queue.id}>
                {c.e > c.s ? (
                  <Box title={`${b.queue.queue_number} ${labelOfMinutes(b.start)}–${labelOfMinutes(b.end)}${b.queue.customer_name ? ` · ${b.queue.customer_name}` : ''}`} sx={{ ...blockSx, left: x(c.s), width: widthPct(c.s, c.e), bgcolor: busyBg, color: 'text.secondary', borderLeft: 1, borderRight: 1, borderColor: 'divider', pointerEvents: 'auto' }}>
                    {b.queue.queue_number}
                    {wide ? <Box component="small" sx={{ fontWeight: 500, fontSize: 10 }}>{labelOfMinutes(b.start)}–{labelOfMinutes(b.end)}</Box> : null}
                  </Box>
                ) : null}
                {buf.e > buf.s ? <Box sx={{ ...blockSx, left: x(buf.s), width: widthPct(buf.s, buf.e), background: hatch }} /> : null}
              </Box>
            );
          })}

          {valid ? (() => { const c = clip(day.startMin, end); return c.e > c.s ? (
            <Box sx={{ ...blockSx, left: x(c.s), width: widthPct(c.s, c.e), bgcolor: over ? 'error.main' : 'primary.main', color: 'primary.contrastText', zIndex: 2, borderRadius: '4px 0 0 4px', transition: theme.transitions.create('width', { duration: 120 }) }}>
              {minutes >= minutesForPx(70) ? <>คิวนี้ · {minutes}′<Box component="small" sx={{ fontWeight: 500, fontSize: 10 }}>{labelOfMinutes(day.startMin)}–{labelOfMinutes(end)}</Box></> : null}
            </Box>
          ) : null; })() : null}

          {valid && !over && limit !== null && limit - end >= minutesForPx(54) ? (
            <Box sx={{ ...blockSx, left: x(end), width: widthPct(end, limit), color: 'success.main' }}>ว่าง {limit - end}′</Box>
          ) : null}

          {limit !== null && limit >= view.start && limit <= view.end ? (
            <Box sx={{ position: 'absolute', top: 0, bottom: 0, left: x(limit), width: 0, borderLeft: 2, borderLeftStyle: 'dashed', borderColor: 'error.main', zIndex: 3, pointerEvents: 'none' }} />
          ) : null}

          {nowMin !== null && nowMin >= view.start && nowMin <= view.end ? (
            <Box sx={{ position: 'absolute', top: 0, bottom: 0, left: x(nowMin), width: '2px', bgcolor: 'warning.main', zIndex: 3, pointerEvents: 'none' }}>
              <Box component="span" sx={{ position: 'absolute', top: 2, left: 4, fontSize: 9.5, fontWeight: 700, color: 'warning.main' }}>ตอนนี้</Box>
            </Box>
          ) : null}
        </Box>

        <Box sx={{ position: 'relative', height: 34, fontSize: 11 }}>
          {limit !== null && limit >= view.start && limit <= view.end ? (
            <Marker left={x(limit)} color="error.main" align={markersClose && !endMarkerLeft ? 'left' : markersClose ? 'right' : 'center'} time={labelOfMinutes(limit)} label="ต้องจบก่อน" />
          ) : null}
          {valid && end >= view.start && end <= view.end ? (
            <Marker left={x(end)} color={over ? 'error.main' : 'primary.main'} align={markersClose && endMarkerLeft ? 'left' : markersClose ? 'right' : 'center'} time={labelOfMinutes(end)} label="สิ้นสุด" />
          ) : null}
        </Box>

        <Stack direction="row" flexWrap="wrap" useFlexGap spacing={1.5} sx={{ fontSize: 11, color: 'text.secondary' }}>
          <LegendItem sx={{ bgcolor: 'primary.main' }} label="คิวนี้" />
          <LegendItem sx={{ bgcolor: busyBg, border: 1, borderColor: 'divider' }} label="คิวอื่น" />
          <LegendItem sx={{ background: hatch, border: 1, borderColor: 'divider' }} label={`เผื่อ turnaround ${day.bufferMinutes}′`} />
          <LegendItem sx={{ bgcolor: alpha(theme.palette.success.main, 0.12), border: 1, borderStyle: 'dashed', borderColor: 'success.main' }} label="ว่าง" />
          <LegendItem sx={{ background: breakBg }} label="พัก" />
        </Stack>
      </Stack>

      <Box sx={{ display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: 1.5, rowGap: 0.25, px: 1.5, py: 1, borderRadius: 1, border: 1, borderColor: 'divider', bgcolor: 'background.default', fontSize: 12.5 }}>
        {day.next ? (
          <>
            <Typography variant="caption" color="text.secondary">คิวถัดไปบนท่านี้</Typography>
            <Typography variant="caption" fontWeight={700}>{day.next.queue_number} · {labelOfMinutes(minutesOfDay(day.next.start_time))}–{day.next.end_time ? labelOfMinutes(minutesOfDay(day.next.end_time)) : '?'} น.{day.next.customer_name ? ` · ${day.next.customer_name}` : ''}</Typography>
            <Typography variant="caption" color="text.secondary">ต้องจบก่อน</Typography>
            <Typography variant="caption" fontWeight={700}>{labelOfMinutes(limit ?? 0)} น. <Box component="span" sx={{ fontWeight: 400, color: 'text.secondary' }}>(เผื่อ turnaround {day.bufferMinutes} นาที)</Box></Typography>
          </>
        ) : (
          <>
            <Typography variant="caption" color="text.secondary">คิวถัดไปบนท่านี้</Typography>
            <Typography variant="caption" fontWeight={700}>ไม่มี — ยืดได้ถึงสิ้นวัน</Typography>
          </>
        )}
        <Typography variant="caption" color="text.secondary">ยืดได้สูงสุด</Typography>
        <Typography variant="caption" fontWeight={700} color={over ? 'error.main' : undefined}>
          {day.maxMinutes} นาที
          {valid && !over ? <Box component="span" sx={{ fontWeight: 400, color: 'text.secondary' }}> · เหลืออีก {day.maxMinutes - minutes} นาที</Box> : null}
          {over ? <Box component="span" sx={{ fontWeight: 400 }}> · เกินอยู่ {minutes - day.maxMinutes} นาที</Box> : null}
        </Typography>
      </Box>

      <Box>
        <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ mb: 0.75 }}>
          <Typography variant="caption" fontWeight={700}>ช่วงว่างวันนี้บน{dockName}</Typography>
          <Typography variant="caption" color="text.secondary">แตะเพื่อยืดให้เต็มช่วง</Typography>
        </Stack>
        {day.freeWindows.length === 0 ? <Typography variant="caption" color="text.secondary">ไม่มีช่วงว่างบนท่านี้</Typography> : null}
        <Stack direction="row" flexWrap="wrap" useFlexGap spacing={0.75}>
          {day.freeWindows.map((w) => {
            const here = w.containsSelf;
            const label = `${labelOfMinutes(w.start)}–${labelOfMinutes(w.end)} · ${here ? `คิวนี้อยู่นี่ ${w.end - day.startMin}′` : `${w.end - w.start}′`}`;
            const chip = (
              <Chip
                size="small"
                label={label}
                color={here ? 'primary' : 'success'}
                variant={here ? 'filled' : 'outlined'}
                disabled={!here}
                onClick={here ? () => onPick(Math.min(1440, w.end - day.startMin)) : undefined}
                sx={{ fontVariantNumeric: 'tabular-nums', opacity: !here && w.end - w.start < TINY_WINDOW ? 0.6 : undefined, '&.Mui-disabled': { opacity: !here && w.end - w.start < TINY_WINDOW ? 0.45 : 0.8 } }}
              />
            );
            return here ? <span key={w.start}>{chip}</span> : <Tooltip key={w.start} title="ยืดข้ามคิวอื่นไม่ได้ — ถ้าต้องการช่วงนี้ให้ย้ายคิว"><span>{chip}</span></Tooltip>;
          })}
        </Stack>
      </Box>
    </Stack>
  );
}

/** Triangle + time + caption under the bar. */
function Marker({ left, color, align, time, label }: { left: string; color: string; align: 'left' | 'right' | 'center'; time: string; label: string }) {
  const transform = align === 'center' ? 'translateX(-50%)' : align === 'left' ? 'translateX(-100%)' : 'none';
  const justifyItems = align === 'center' ? 'center' : align === 'left' ? 'end' : 'start';
  return (
    <Box sx={{ position: 'absolute', top: 0, left, transform, display: 'grid', justifyItems, gap: '1px', whiteSpace: 'nowrap', color, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
      <Box sx={{ width: 0, height: 0, borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderBottom: '6px solid currentColor' }} />
      <span>{time}</span>
      <Box component="small" sx={{ fontWeight: 500, fontSize: 10.5 }}>{label}</Box>
    </Box>
  );
}

function LegendItem({ sx, label }: { sx: Record<string, unknown>; label: string }) {
  return (
    <Stack direction="row" alignItems="center" spacing={0.5}>
      <Box sx={{ width: 10, height: 10, borderRadius: '2px', ...sx }} />
      <span>{label}</span>
    </Stack>
  );
}
