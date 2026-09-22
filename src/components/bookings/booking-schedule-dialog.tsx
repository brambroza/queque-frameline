'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent as ReactPointerEvent } from 'react';
import {
  Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Skeleton, Stack, TextField, Typography,
} from '@mui/material';
import { alpha, useTheme, type Theme } from '@mui/material/styles';
import {
  computeDockDay, labelOfMinutes, minutesOfDay, snapToSlot,
  type DockBoardLane, type DockBoardResponse, type DockDay,
} from '@/lib/booking/dock-day';
import type { ItemMinutesRule } from '@/lib/booking/suggest-minutes';
import { QUICK_MINUTES, minutesOf, suggestionOf } from './booking-action-dialogs';
import { MOVABLE, customerName, hhmm, type BookingRow } from './booking-types';
import { shortThaiDay } from './dock-slot-picker';

/** What the dialog hands back: the queue's new place on the board and its dock time. */
export type ScheduleDraft = { date: string; dockId: string; start: string; minutes: number };
export type ScheduleChanges = { moved: boolean; minutesChanged: boolean };

type DayOption = { day: string; open_slots: number };

/** Pixels per minute on the lanes; 9 working hours ≈ 400px. */
const PX = 0.74;
const LANE_MIN_WIDTH = 132;
const MAX_BOARD_HEIGHT = 520;
const MINUTES_MIN = 5;
const MINUTES_MAX = 1440;

function useDockBoard(bookingId: string | null, date: string) {
  const [data, setData] = useState<DockBoardResponse | null>(null);
  const [error, setError] = useState(false);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    if (!bookingId || !date) return undefined;
    const ctl = new AbortController();
    setData(null);
    setError(false);
    fetch(`/api/bookings/${bookingId}/dock-board?date=${date}`, { cache: 'no-store', signal: ctl.signal })
      .then(async (r) => {
        const j = (await r.json().catch(() => ({}))) as { data?: DockBoardResponse };
        if (!r.ok || !j.data) throw new Error();
        setData(j.data);
      })
      .catch(() => { if (!ctl.signal.aborted) setError(true); });
    return () => ctl.abort();
  }, [bookingId, date, reload]);
  return { data, error, loading: !data && !error, retry: () => setReload((k) => k + 1) };
}

function useAvailableDays(booking: BookingRow | null, enabled: boolean) {
  const [days, setDays] = useState<DayOption[] | null>(null);
  useEffect(() => {
    if (!booking || !enabled || !booking.service_id) { setDays([]); return undefined; }
    const ctl = new AbortController();
    setDays(null);
    const q = new URLSearchParams({ direction: booking.direction, service_id: booking.service_id });
    if (booking.branch_id) q.set('branch_id', booking.branch_id);
    fetch(`/api/available-days?${q}`, { cache: 'no-store', signal: ctl.signal })
      .then(async (r) => { const j = (await r.json()) as { data?: DayOption[] }; if (!r.ok) throw new Error(); setDays(j.data ?? []); })
      .catch(() => { if (!ctl.signal.aborted) setDays([]); });
    return () => ctl.abort();
  }, [booking, enabled]);
  return days;
}

/** The queue's original place, for the ghost outline and the diff card. */
function originOf(b: BookingRow): ScheduleDraft {
  return { date: b.booking_date, dockId: b.resource_id ?? '', start: hhmm(b.start_time), minutes: minutesOf(b) };
}

/**
 * One dialog for everything about where a queue sits: day, dock, start time and
 * dock time. Every dock the queue may use is a vertical lane; the queue is a
 * block you drag to another lane or time (snapping to the slots the move RPC
 * accepts) and stretch from the bottom edge. Advisory only — the RPCs decide.
 */
export function BookingScheduleDialog({ booking, saving, itemMinutes, onClose, onSubmit }: {
  booking: BookingRow | null;
  saving: boolean;
  itemMinutes?: ItemMinutesRule;
  onClose: () => void;
  onSubmit: (b: BookingRow, draft: ScheduleDraft, changes: ScheduleChanges) => void;
}) {
  const theme = useTheme();
  const canMove = booking ? MOVABLE.has(booking.status) : false;
  const origin = useMemo(() => (booking ? originOf(booking) : null), [booking]);
  const [draft, setDraft] = useState<ScheduleDraft | null>(null);
  const [minutesText, setMinutesText] = useState('');
  useEffect(() => { if (origin) { setDraft(origin); setMinutesText(String(origin.minutes)); } }, [origin]);

  const board = useDockBoard(booking?.id ?? null, draft?.date ?? '');
  const days = useAvailableDays(booking, canMove);

  const setMinutes = useCallback((m: number) => {
    setMinutesText(String(m));
    setDraft((d) => (d ? { ...d, minutes: m } : d));
  }, []);

  // After a day change the start is blank: land on the first open slot, the original dock first.
  useEffect(() => {
    const data = board.data;
    if (!data || !draft || draft.start) return;
    const ordered = [...data.docks].sort((a, b) => Number(b.id === data.self.resource_id) - Number(a.id === data.self.resource_id));
    const lane = ordered.find((l) => l.slotStarts.length > 0);
    if (lane) setDraft({ ...draft, dockId: lane.id, start: hhmm(lane.slotStarts[0]) });
  }, [board.data, draft]);

  if (!booking || !origin || !draft) return null;
  const data = board.data;
  const minutesValid = Number.isInteger(draft.minutes) && draft.minutes >= MINUTES_MIN && draft.minutes <= MINUTES_MAX;
  const startMin = minutesOfDay(draft.start);
  const moved = draft.date !== origin.date || draft.dockId !== origin.dockId || draft.start !== origin.start;
  const minutesChanged = draft.minutes !== origin.minutes;
  const lane = data?.docks.find((d) => d.id === draft.dockId) ?? null;
  const day: DockDay | null = data && lane
    ? computeDockDay({
      start_time: draft.start, buffer_minutes: data.self.buffer_minutes, others: lane.others, minutes: minutesValid ? draft.minutes : null,
      open_time: data.hours?.open_time, close_time: data.hours?.close_time, break_start: data.hours?.break_start, break_end: data.hours?.break_end,
    })
    : null;
  const laneSlots = lane ? lane.slotStarts.map(minutesOfDay) : [];
  const startIsSlot = !moved || laneSlots.includes(startMin);
  const crossesMidnight = minutesValid && startMin + draft.minutes > 24 * 60;
  const conflict = day ? day.overlaps : [];
  const canSave = minutesValid && (moved || minutesChanged) && !crossesMidnight && conflict.length === 0 && (data ? startIsSlot && Boolean(lane) : true);
  const saveLabel = moved && minutesChanged ? 'เลื่อนคิว + บันทึกเวลา' : moved ? 'เลื่อนคิว' : minutesChanged ? 'บันทึกเวลา' : 'บันทึก';

  const dayChips: DayOption[] = (() => {
    const list = days ?? [];
    return list.some((d) => d.day === origin.date) ? list : [{ day: origin.date, open_slots: 0 }, ...list];
  })();

  const pickDay = (d: string) => {
    if (d === origin.date) { setDraft({ ...draft, date: d, dockId: origin.dockId, start: origin.start }); return; }
    // Land on the first slot of the first lane that has one; the board for that day loads next.
    setDraft({ ...draft, date: d, start: '' });
  };

  const verdict = (() => {
    if (!minutesValid) return { severity: 'warning' as const, text: `ใส่ ${MINUTES_MIN}–${MINUTES_MAX} นาที` };
    if (!data) return null;
    if (!lane) return { severity: 'warning' as const, text: canMove ? 'ลากคิวไปวางบนท่าที่ว่างของวันนี้' : 'คิวนี้ยังไม่ระบุท่า' };
    if (crossesMidnight) return { severity: 'error' as const, text: 'เวลาสิ้นสุดข้ามวัน — ลดเวลาลง' };
    if (conflict.length > 0) {
      const c = conflict[0];
      const nextIsC = day?.next?.id === c.queue.id;
      return { severity: 'error' as const, text: `ชน ${c.queue.queue_number} (${labelOfMinutes(c.start)}–${labelOfMinutes(c.end)}) บน${lane.name} — ${nextIsC && day ? `ยืดได้สูงสุด ${day.maxMinutes} นาที หรือย้ายไปที่ว่าง` : 'เลือกเวลาเริ่มใหม่'}` };
    }
    if (moved && !startIsSlot) return { severity: 'error' as const, text: `${draft.start} ไม่ใช่ช่องที่ระบบเปิดบน${lane.name} — ลากไปช่องที่มีขีด` };
    if (!moved && !minutesChanged) return { severity: 'info' as const, text: 'ยังไม่ได้เปลี่ยนอะไร — ลากบล็อกไปวันที่/ท่า/เวลาที่ว่าง หรือปรับเวลาที่ท่า' };
    const close = data.hours ? minutesOfDay(data.hours.close_time) : null;
    const overClose = close !== null && startMin + draft.minutes > close;
    const left = day ? day.maxMinutes - draft.minutes : 0;
    return {
      severity: overClose ? ('warning' as const) : ('success' as const),
      text: `${overClose ? `จบ ${labelOfMinutes(startMin + draft.minutes)} เลยเวลาปิด ${labelOfMinutes(close)} — บันทึกได้ คลังตัดสินใจเอง` : 'วางได้'} · ${lane.name} ${shortThaiDay(draft.date)} ${draft.start}–${labelOfMinutes(startMin + draft.minutes)} น.${left > 0 ? ` · ยังยืดได้อีก ${left} นาที` : ''}`,
    };
  })();

  const suggestion = suggestionOf(booking, itemMinutes);
  const lines = booking.external_documents?.item_count ?? 0;

  return (
    <Dialog open onClose={saving ? undefined : onClose} fullWidth maxWidth="md">
      <DialogTitle sx={{ pb: 1 }}>
        <Stack direction="row" alignItems="baseline" spacing={1.5} flexWrap="wrap" useFlexGap>
          <span>จัดตารางคิว {booking.queue_number}</span>
          <Typography variant="body2" color="text.secondary" component="span">
            {customerName(booking)}{booking.external_documents?.doc_no ? ` · ${booking.external_documents.doc_no}` : ''} · {booking.services?.service_name ?? '-'}
          </Typography>
        </Stack>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 0.5 }}>
          {canMove ? (
            <Box>
              <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ mb: 0.75 }}>
                <Typography variant="subtitle2" fontWeight={700}>วัน</Typography>
                <Typography variant="caption" color="text.secondary">ตัวเลข = ช่องว่างของประเภทรถนี้ในวันนั้น</Typography>
              </Stack>
              {days === null ? <Skeleton variant="rounded" height={36} /> : (
                <Stack direction="row" spacing={1} sx={{ overflowX: 'auto', pb: 0.5 }}>
                  {dayChips.map((d) => (
                    <Chip
                      key={d.day}
                      clickable
                      color={d.day === draft.date ? 'primary' : 'default'}
                      variant={d.day === draft.date ? 'filled' : 'outlined'}
                      label={`${shortThaiDay(d.day)}${d.day === origin.date ? ' (เดิม)' : ''}${d.day !== origin.date ? ` · ว่าง ${d.open_slots}` : ''}`}
                      onClick={() => pickDay(d.day)}
                      sx={{ flexShrink: 0, height: 36 }}
                    />
                  ))}
                </Stack>
              )}
            </Box>
          ) : (
            <Alert severity="info">คิวสถานะ “{booking.status}” ย้ายวัน/เวลา/ท่าไม่ได้แล้ว — ปรับได้เฉพาะเวลาที่ท่า</Alert>
          )}

          <Box>
            <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ mb: 0.75 }} flexWrap="wrap" useFlexGap>
              <Typography variant="subtitle2" fontWeight={700}>{shortThaiDay(draft.date)} · ท่าที่รับ{booking.services?.service_name ?? 'รถประเภทนี้'}</Typography>
              <Typography variant="caption" color="text.secondary">{canMove ? 'ลากบล็อกไปท่า/เวลาที่ว่าง (ขีด = ช่องที่เปิด) · ลากขอบล่างเพื่อยืด' : 'ลากขอบล่างเพื่อยืด/หด'}</Typography>
            </Stack>
            {board.error ? <Alert severity="error" action={<Button color="inherit" size="small" onClick={board.retry}>ลองใหม่</Button>}>โหลดตารางท่าไม่สำเร็จ</Alert> : null}
            {board.loading ? <Skeleton variant="rounded" height={320} /> : null}
            {data && data.docks.length === 0 ? <Alert severity="warning">ไม่มีท่าที่รับประเภทรถนี้ในสาขา — ตรวจการตั้งค่าท่า</Alert> : null}
            {data && data.docks.length > 0 ? (
              <DockBoard
                data={data}
                draft={draft}
                origin={origin}
                minutesValid={minutesValid}
                conflict={conflict.length > 0 || crossesMidnight}
                canMove={canMove}
                queueNumber={booking.queue_number}
                onPlace={(dockId, start) => setDraft((d) => (d ? { ...d, dockId, start } : d))}
                onMinutes={setMinutes}
              />
            ) : null}
            <Stack direction="row" flexWrap="wrap" useFlexGap spacing={1.5} sx={{ fontSize: 11, color: 'text.secondary', mt: 0.75 }}>
              <LegendItem sx={{ bgcolor: 'primary.main' }} label="ตำแหน่งใหม่" />
              <LegendItem sx={{ border: 2, borderStyle: 'dashed', borderColor: alpha(theme.palette.primary.main, 0.5) }} label="ตำแหน่งเดิม" />
              <LegendItem sx={{ bgcolor: theme.palette.grey[200], border: 1, borderColor: 'divider' }} label="คิวอื่น" />
              <LegendItem sx={{ background: hatch(theme), border: 1, borderColor: 'divider' }} label={`เผื่อ turnaround ${data?.self.buffer_minutes ?? 0}′`} />
              <LegendItem sx={{ bgcolor: alpha(theme.palette.success.main, 0.12), border: 1, borderStyle: 'dashed', borderColor: 'success.main' }} label="ว่าง" />
            </Stack>
          </Box>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'flex-start' }}>
            <TextField
              id="schedule-service-minutes"
              label="เวลาที่ท่า (นาที)"
              type="number"
              size="small"
              value={minutesText}
              onChange={(e) => { setMinutesText(e.target.value); setDraft((d) => (d ? { ...d, minutes: Number(e.target.value) } : d)); }}
              error={!minutesValid || crossesMidnight || (conflict.length > 0 && !moved)}
              helperText={!minutesValid ? `ใส่ ${MINUTES_MIN}–${MINUTES_MAX} นาที` : `${draft.start || '--:--'} – ${draft.start ? labelOfMinutes(startMin + draft.minutes) : '--:--'} น.${booking.services?.duration_minutes ? ` · ค่าตั้งต้น ${booking.services.duration_minutes} นาที` : ''}`}
              slotProps={{ htmlInput: { min: MINUTES_MIN, max: MINUTES_MAX, step: 5 } }}
              sx={{ minWidth: 200 }}
            />
            <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ pt: { sm: 0.75 } }}>
              {suggestion.source === 'items' ? (
                <Chip size="small" color="info" variant={draft.minutes === suggestion.minutes ? 'filled' : 'outlined'} label={`ตามรายการ ${lines} × ${itemMinutes?.minutesPerItem ?? 10} = ${suggestion.minutes} นาที`} onClick={() => setMinutes(suggestion.minutes)} />
              ) : null}
              {QUICK_MINUTES.map((m) => {
                const blocked = day !== null && m > day.maxMinutes;
                return <Chip key={m} size="small" label={blocked && day?.next ? `${m} · ชน ${day.next.queue_number}` : `${m} นาที`} variant={draft.minutes === m ? 'filled' : 'outlined'} color={draft.minutes === m ? 'primary' : 'default'} disabled={blocked} onClick={() => setMinutes(m)} />;
              })}
            </Stack>
          </Stack>

          <DiffCard origin={origin} draft={draft} lanes={data?.docks ?? []} originDockName={booking.resource_name ?? null} />
          {verdict ? <Alert severity={verdict.severity}>{verdict.text}</Alert> : null}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 2, pb: 2, flexWrap: 'wrap', gap: 1 }}>
        <Button size="small" color="inherit" variant="outlined" disabled={saving || (!moved && !minutesChanged)} onClick={() => { setDraft(origin); setMinutesText(String(origin.minutes)); }}>คืนค่าเดิม</Button>
        <Box sx={{ flex: 1 }} />
        <Button onClick={onClose} disabled={saving}>ปิด</Button>
        <Button variant="contained" disabled={saving || !canSave} onClick={() => onSubmit(booking, draft, { moved, minutesChanged })}>{saving ? 'กำลังบันทึก…' : saveLabel}</Button>
      </DialogActions>
    </Dialog>
  );
}

function hatch(theme: Theme) {
  return `repeating-linear-gradient(135deg, transparent 0 3px, ${alpha(theme.palette.common.black, 0.1)} 3px 6px)`;
}

/** Lanes per dock with the draggable queue block. Pure rendering + pointer math; state lives in the dialog. */
function DockBoard({ data, draft, origin, minutesValid, conflict, canMove, queueNumber, onPlace, onMinutes }: {
  data: DockBoardResponse;
  draft: ScheduleDraft;
  origin: ScheduleDraft;
  minutesValid: boolean;
  conflict: boolean;
  canMove: boolean;
  queueNumber: string;
  onPlace: (dockId: string, start: string) => void;
  onMinutes: (m: number) => void;
}) {
  const theme = useTheme();
  const lanesRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ kind: 'move' | 'resize'; grabOffset: number; y0: number; m0: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  const startMin = draft.start ? minutesOfDay(draft.start) : Number.NaN;
  const buffer = Math.max(0, data.self.buffer_minutes ?? 0);
  const perLane = useMemo(() => data.docks.map((lane) => ({
    lane,
    day: computeDockDay({ start_time: draft.start || data.self.start_time, buffer_minutes: buffer, others: lane.others, open_time: data.hours?.open_time, close_time: data.hours?.close_time, break_start: data.hours?.break_start, break_end: data.hours?.break_end }),
    slots: lane.slotStarts.map(minutesOfDay),
  })), [data, draft.start, buffer]);

  // One time axis for every lane: union of what each lane needs, plus the draft block itself.
  let viewOpen = Math.min(...perLane.map((p) => p.day.viewOpen));
  let viewClose = Math.max(...perLane.map((p) => p.day.viewClose));
  if (Number.isFinite(startMin) && minutesValid) { viewOpen = Math.min(viewOpen, Math.floor(startMin / 60) * 60); viewClose = Math.max(viewClose, Math.min(24 * 60, Math.ceil((startMin + draft.minutes) / 60) * 60)); }
  const span = Math.max(60, viewClose - viewOpen);
  const height = span * PX;
  const y = (m: number) => (m - viewOpen) * PX;
  const nowMin = data.now.date === data.date ? minutesOfDay(data.now.time) : null;
  const showGhost = draft.date === origin.date && origin.dockId && (draft.dockId !== origin.dockId || draft.start !== origin.start || draft.minutes !== origin.minutes);
  const originStart = minutesOfDay(origin.start);

  const laneAt = (clientX: number): { el: HTMLElement; lane: DockBoardLane; slots: number[] } | null => {
    const els = lanesRef.current?.querySelectorAll<HTMLElement>('[data-lane]') ?? [];
    for (const el of Array.from(els)) {
      const r = el.getBoundingClientRect();
      if (clientX >= r.left && clientX <= r.right) {
        const p = perLane.find((x) => x.lane.id === el.dataset.lane);
        if (p) return { el, lane: p.lane, slots: p.slots };
      }
    }
    return null;
  };
  const minuteAt = (el: HTMLElement, clientY: number) => viewOpen + (clientY - el.getBoundingClientRect().top) / PX;

  const beginDrag = (e: ReactPointerEvent<HTMLElement>, kind: 'move' | 'resize') => {
    if (kind === 'move' && !canMove) return;
    const laneEl = (e.currentTarget as HTMLElement).closest<HTMLElement>('[data-lane]');
    if (!laneEl) return;
    const grabOffset = kind === 'move' ? minuteAt(laneEl, e.clientY) - startMin : 0;
    dragRef.current = { kind, grabOffset, y0: e.clientY, m0: draft.minutes };
    setDragging(true);
    const move = (ev: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      if (d.kind === 'resize') {
        onMinutes(Math.max(MINUTES_MIN, Math.min(MINUTES_MAX, Math.round((d.m0 + (ev.clientY - d.y0) / PX) / 5) * 5)));
        return;
      }
      const hit = laneAt(ev.clientX);
      if (!hit) return;
      const snapped = snapToSlot(minuteAt(hit.el, ev.clientY) - d.grabOffset, hit.slots);
      if (snapped !== null) onPlace(hit.lane.id, labelOfMinutes(snapped));
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      dragRef.current = null;
      setDragging(false);
      if (lanesRef.current) lanesRef.current.dataset.justDragged = '1';
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    e.preventDefault();
    e.stopPropagation();
  };

  const clickLane = (e: MouseEvent<HTMLElement>, lane: DockBoardLane, slots: number[]) => {
    if (!canMove) return;
    if (lanesRef.current?.dataset.justDragged) { delete lanesRef.current.dataset.justDragged; return; }
    if ((e.target as HTMLElement).closest('[data-me]')) return;
    const snapped = snapToSlot(minuteAt(e.currentTarget, e.clientY), slots);
    if (snapped !== null) onPlace(lane.id, labelOfMinutes(snapped));
  };

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const idx = perLane.findIndex((p) => p.lane.id === draft.dockId);
    if (idx < 0) return;
    const cur = perLane[idx];
    if (e.shiftKey && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) { onMinutes(Math.max(MINUTES_MIN, Math.min(MINUTES_MAX, draft.minutes + (e.key === 'ArrowDown' ? 5 : -5)))); e.preventDefault(); return; }
    if (!canMove) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      const next = e.key === 'ArrowDown' ? cur.slots.find((s) => s > startMin) : [...cur.slots].reverse().find((s) => s < startMin);
      if (next !== undefined) onPlace(cur.lane.id, labelOfMinutes(next));
      e.preventDefault();
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      const target = perLane[idx + (e.key === 'ArrowRight' ? 1 : -1)];
      if (target) { const s = target.slots.includes(startMin) ? startMin : snapToSlot(startMin, target.slots); if (s !== null) onPlace(target.lane.id, labelOfMinutes(s)); }
      e.preventDefault();
    }
  };

  const busyBg = theme.palette.grey[200];
  const breakBg = `repeating-linear-gradient(135deg, ${theme.palette.grey[100]} 0 6px, ${theme.palette.grey[300]} 6px 12px)`;
  const blockSx = { position: 'absolute', left: 3, right: 3, borderRadius: 1, fontSize: 10.5, fontWeight: 700, px: 0.75, py: 0.25, overflow: 'hidden', whiteSpace: 'nowrap', lineHeight: 1.3, fontVariantNumeric: 'tabular-nums' } as const;
  const ticks: number[] = [];
  for (let t = Math.ceil(viewOpen / 60) * 60; t <= viewClose; t += 60) ticks.push(t);

  return (
    <Box sx={{ overflowX: 'auto', overflowY: height > MAX_BOARD_HEIGHT ? 'auto' : 'visible', maxHeight: height > MAX_BOARD_HEIGHT ? MAX_BOARD_HEIGHT : undefined, pb: 0.5 }}>
      <Box ref={lanesRef} sx={{ display: 'grid', gridTemplateColumns: `44px repeat(${data.docks.length}, minmax(${LANE_MIN_WIDTH}px, 1fr))`, columnGap: 0.75, minWidth: 44 + data.docks.length * LANE_MIN_WIDTH }}>
        <Box />
        {perLane.map(({ lane, day }) => {
          const free = day.freeWindows.filter((w) => w.end - w.start >= 30);
          return (
            <Box key={`h${lane.id}`} sx={{ textAlign: 'center', pb: 0.5, minWidth: 0 }}>
              <Typography variant="body2" fontWeight={700} noWrap>{lane.code ? `${lane.code} · ` : ''}{lane.name}{lane.id === origin.dockId && draft.date === origin.date ? ' (เดิม)' : ''}</Typography>
              <Typography variant="caption" color="text.secondary" noWrap component="div">{free.length ? `ว่าง ${free.map((w) => `${labelOfMinutes(w.start)}–${labelOfMinutes(w.end)}`).join(', ')}` : 'เต็ม'}</Typography>
            </Box>
          );
        })}

        <Box sx={{ position: 'relative', height, fontSize: 10.5, color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}>
          {ticks.map((t) => <Box key={t} component="span" sx={{ position: 'absolute', right: 6, top: y(t), transform: 'translateY(-50%)' }}>{labelOfMinutes(t)}</Box>)}
        </Box>

        {perLane.map(({ lane, day, slots }) => {
          const isTarget = lane.id === draft.dockId;
          return (
            <Box
              key={lane.id}
              data-lane={lane.id}
              onClick={(e) => clickLane(e, lane, slots)}
              sx={{
                position: 'relative', height, borderRadius: 1, overflow: 'hidden', border: 1, borderColor: 'divider',
                bgcolor: alpha(theme.palette.success.main, 0.12), cursor: canMove ? 'crosshair' : 'default', touchAction: 'none',
                boxShadow: dragging && isTarget ? `inset 0 0 0 2px ${theme.palette.primary.main}` : undefined,
              }}
            >
              {ticks.filter((t) => t > viewOpen && t < viewClose).map((t) => <Box key={`l${t}`} sx={{ position: 'absolute', left: 0, right: 0, top: y(t), height: '1px', bgcolor: 'divider' }} />)}
              {canMove ? slots.map((s) => <Box key={`s${s}`} sx={{ position: 'absolute', left: 0, width: 6, top: y(s), height: '2px', bgcolor: 'success.main', opacity: 0.7 }} />) : null}
              {day.breakRange ? <Box sx={{ ...blockSx, left: 0, right: 0, borderRadius: 0, top: y(day.breakRange.start), height: (day.breakRange.end - day.breakRange.start) * PX, background: breakBg, color: 'text.secondary', textAlign: 'center', fontWeight: 500 }}>พัก</Box> : null}
              {day.blocks.map((b) => (
                <Box key={b.queue.id}>
                  <Box title={`${b.queue.queue_number} ${labelOfMinutes(b.start)}–${labelOfMinutes(b.end)}${b.queue.customer_name ? ` · ${b.queue.customer_name}` : ''}`} sx={{ ...blockSx, top: y(b.start), height: (b.end - b.start) * PX, bgcolor: busyBg, color: 'text.secondary', border: 1, borderColor: 'divider' }}>
                    {b.queue.queue_number} <Box component="span" sx={{ fontWeight: 500 }}>{labelOfMinutes(b.start)}–{labelOfMinutes(b.end)}</Box>
                  </Box>
                  {b.bufferEnd > b.end ? <Box sx={{ ...blockSx, top: y(b.end), height: (b.bufferEnd - b.end) * PX, background: hatch(theme), borderRadius: 0 }} /> : null}
                </Box>
              ))}
              {showGhost && lane.id === origin.dockId ? (
                <Box sx={{ ...blockSx, top: y(originStart), height: origin.minutes * PX, border: 2, borderStyle: 'dashed', borderColor: alpha(theme.palette.primary.main, 0.5), color: 'primary.dark', fontWeight: 500 }}>เดิม {origin.start}</Box>
              ) : null}
              {isTarget && Number.isFinite(startMin) && minutesValid ? (
                <Box
                  data-me="1"
                  tabIndex={0}
                  role="button"
                  aria-label={`${queueNumber} ${draft.start} ${draft.minutes} นาที — ลูกศรขึ้นลงย้ายช่อง ซ้ายขวาย้ายท่า Shift+ขึ้นลงปรับนาที`}
                  onKeyDown={onKey}
                  onPointerDown={(e) => beginDrag(e, 'move')}
                  onClick={(e) => e.stopPropagation()}
                  sx={{
                    ...blockSx, top: y(startMin), height: Math.max(18, draft.minutes * PX), zIndex: 2, color: 'primary.contrastText',
                    bgcolor: conflict ? 'error.main' : 'primary.main', boxShadow: 2, cursor: canMove ? (dragging ? 'grabbing' : 'grab') : 'default',
                    '&:focus-visible': { outline: `2px solid ${theme.palette.warning.main}`, outlineOffset: 2 },
                  }}
                >
                  {queueNumber} {draft.start}
                  <Box component="span" sx={{ position: 'absolute', right: 6, bottom: 12, fontWeight: 500, opacity: 0.9 }}>{labelOfMinutes(startMin + draft.minutes)} · {draft.minutes}′</Box>
                  <Box
                    onPointerDown={(e) => beginDrag(e, 'resize')}
                    title="ลากเพื่อยืด/หดเวลาที่ท่า"
                    sx={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 12, cursor: 'ns-resize', '&::after': { content: '""', display: 'block', width: 28, height: 3, borderRadius: 2, bgcolor: 'primary.contrastText', opacity: 0.9, mx: 'auto', mt: '5px' } }}
                  />
                </Box>
              ) : null}
              {nowMin !== null && nowMin >= viewOpen && nowMin <= viewClose ? (
                <Box sx={{ position: 'absolute', left: 0, right: 0, top: y(nowMin), height: '2px', bgcolor: 'warning.main', zIndex: 3, pointerEvents: 'none' }} />
              ) : null}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

function DiffCard({ origin, draft, lanes, originDockName }: { origin: ScheduleDraft; draft: ScheduleDraft; lanes: DockBoardLane[]; originDockName: string | null }) {
  const dockName = (id: string) => lanes.find((l) => l.id === id)?.name ?? (id === origin.dockId ? originDockName : null) ?? (id ? 'ท่า' : 'ยังไม่ระบุ');
  const rows: Array<{ k: string; from: string; to: string }> = [
    { k: 'วัน', from: shortThaiDay(origin.date), to: shortThaiDay(draft.date) },
    { k: 'เริ่ม', from: origin.start, to: draft.start || '—' },
    { k: 'ท่า', from: dockName(origin.dockId), to: dockName(draft.dockId) },
    { k: 'เวลาที่ท่า', from: `${origin.minutes} นาที`, to: `${Number.isFinite(draft.minutes) ? draft.minutes : '—'} นาที` },
  ];
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: 1.5, rowGap: 0.25, px: 1.5, py: 1, borderRadius: 1, border: 1, borderColor: 'divider', bgcolor: 'background.default' }}>
      {rows.map((r) => {
        const changed = r.from !== r.to;
        return (
          <Box key={r.k} sx={{ display: 'contents' }}>
            <Typography variant="caption" color="text.secondary">{r.k}</Typography>
            <Typography variant="caption" fontWeight={changed ? 700 : 500} color={changed ? 'primary.dark' : 'text.secondary'} sx={{ fontVariantNumeric: 'tabular-nums' }}>
              {changed ? <><Box component="span" sx={{ textDecoration: 'line-through', fontWeight: 500, color: 'text.secondary', mr: 0.75 }}>{r.from}</Box>→ {r.to}</> : r.to}
            </Typography>
          </Box>
        );
      })}
      {draft.date !== origin.date ? <><Box /><Typography variant="caption" color="warning.main">ย้ายข้ามวัน = ได้เลขคิวใหม่ของวันนั้น · แจ้งลูกค้าด้วย</Typography></> : null}
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
