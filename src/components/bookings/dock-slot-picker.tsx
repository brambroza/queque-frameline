'use client';

import { useEffect, useMemo, useState } from 'react';
import { Alert, Box, Button, Chip, Divider, Paper, Skeleton, Stack, Typography } from '@mui/material';
import type { BookingDirection } from '@/types/db';
import { summarizeWalkInSlots, visibleWalkInSlots, type LastQueue, type WalkInSlotView } from '@/lib/booking/slot-time';
import { hhmm, type SlotOption } from './booking-types';

type DayOption = { day: string; open_slots: number };

/** `meta` of `GET /api/available-slots?walk_in=1`. */
type WalkInMeta = { date?: string; now?: string; last_queue?: LastQueue | null };

const WEEKDAY = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
const MONTH = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

/** "จ. 21 ก.ย." from an ISO date, without timezone drift. */
export function shortThaiDay(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${WEEKDAY[dow]} ${d} ${MONTH[m - 1]}`;
}

/** Line under the time on a slot button (regular create / reschedule). */
function slotHint(s: SlotOption): string {
  if (s.is_past) return 'ผ่านแล้ว';
  if (s.remaining_capacity <= 0) return `เต็ม ${s.capacity}/${s.capacity}`;
  const free = `ว่าง ${s.remaining_capacity}/${s.capacity}`;
  return s.in_progress ? `กำลังเดิน · ${free}` : free;
}

/** The API rows as the walk-in helpers expect them (`too_soon` never applies to a walk-in). */
function toWalkInViews(slots: SlotOption[]): WalkInSlotView[] {
  return slots.map((s) => ({ ...s, booked_count: Math.max(s.capacity - s.remaining_capacity, 0), too_soon: false, in_progress: Boolean(s.in_progress), overflow: Boolean(s.overflow) }));
}

/** Walk-in slot button: one word the gate can read at a glance. */
function walkInWord(s: WalkInSlotView): { word: string; color: 'success' | 'warning' | 'inherit' } {
  if (!s.bookable) return { word: 'เต็ม', color: 'inherit' };
  if (s.overflow) return { word: 'ต่อท้าย', color: 'warning' };
  return { word: 'ว่าง', color: 'success' };
}

/** A legend dot + label. */
function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <Stack direction="row" spacing={0.5} alignItems="center">
      <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: color }} />
      <Typography variant="caption" color="text.secondary">{label}</Typography>
    </Stack>
  );
}

/**
 * Date + time picker that only offers what can actually be booked: days with
 * an open slot for this vehicle type / direction, then that day's slots with
 * full and past ones disabled.
 *
 * `walkIn` = the truck is already on site: no day to choose (the server picks
 * today), finished slots are left out, the slot running now may be taken and,
 * when working hours are used up, the truck can queue after the last booking
 * (overflow slots after closing time). The header says what is free now and
 * which queue is last, so the gate does not have to read the whole grid.
 */
export function DockSlotPicker({
  direction, serviceId, branchId, dockId, excludeBookingId, date, time, onChange, walkIn = false, refreshKey = 0,
}: {
  direction: BookingDirection;
  serviceId: string;
  /** Branch whose docks and hours apply; empty = site default. */
  branchId?: string;
  /** Restrict to one dock; empty = any eligible dock. */
  dockId?: string;
  /** Reschedule: ignore this booking's own slot. */
  excludeBookingId?: string;
  date: string;
  time: string;
  /** `overflow` = a walk-in chose to queue after the last booking (slot past closing time). */
  onChange: (next: { date: string; time: string; overflow?: boolean }) => void;
  /** Walk-in mode: today's slots only, including the one in progress. `date` is ignored. */
  walkIn?: boolean;
  /** Bump to refetch the slots, e.g. after the server refused the chosen one. */
  refreshKey?: number;
}) {
  const [days, setDays] = useState<DayOption[] | null>(null);
  const [daysError, setDaysError] = useState(false);
  const [slots, setSlots] = useState<SlotOption[] | null>(null);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  /** Walk-in: the day the server used (its "today"), its clock and the last queue. */
  const [meta, setMeta] = useState<WalkInMeta>({});

  useEffect(() => {
    if (!serviceId || walkIn) return;
    const ctl = new AbortController();
    setDays(null);
    setDaysError(false);
    const dq = new URLSearchParams({ direction, service_id: serviceId });
    if (branchId) dq.set('branch_id', branchId);
    fetch(`/api/available-days?${dq}`, { cache: 'no-store', signal: ctl.signal })
      .then(async (r) => { const j = (await r.json()) as { data?: DayOption[] }; if (!r.ok) throw new Error(); setDays(j.data ?? []); })
      .catch(() => { if (!ctl.signal.aborted) setDaysError(true); });
    return () => ctl.abort();
  }, [direction, serviceId, branchId, reload, walkIn]);

  // A walk-in never sends a date, so choosing a slot (which reports the day back) cannot refetch.
  const queryDate = walkIn ? '' : date;
  useEffect(() => {
    if (!serviceId || (!walkIn && !queryDate)) { setSlots(null); return; }
    const ctl = new AbortController();
    setSlots(null);
    setSlotsError(null);
    const qs = new URLSearchParams({ direction, service_id: serviceId });
    if (walkIn) qs.set('walk_in', '1');
    else qs.set('date', queryDate);
    if (branchId) qs.set('branch_id', branchId);
    if (dockId) qs.set('resource_id', dockId);
    if (excludeBookingId) qs.set('exclude_booking_id', excludeBookingId);
    fetch(`/api/available-slots?${qs}`, { cache: 'no-store', signal: ctl.signal })
      .then(async (r) => {
        const j = (await r.json()) as { data?: SlotOption[]; meta?: WalkInMeta; error?: string };
        if (!r.ok) throw new Error(j.error || 'โหลดช่วงเวลาไม่สำเร็จ');
        setSlots(j.data ?? []);
        setMeta(j.meta ?? {});
      })
      .catch((e: unknown) => { if (!ctl.signal.aborted) setSlotsError(e instanceof Error && e.message ? e.message : 'โหลดช่วงเวลาไม่สำเร็จ'); });
    return () => ctl.abort();
  }, [direction, serviceId, branchId, dockId, excludeBookingId, queryDate, walkIn, reload, refreshKey]);

  const walkInViews = useMemo(() => (walkIn && slots ? toWalkInViews(slots) : []), [walkIn, slots]);
  const summary = useMemo(() => summarizeWalkInSlots(walkInViews), [walkInViews]);
  const walkInShown = useMemo(() => visibleWalkInSlots(walkInViews), [walkInViews]);

  if (!serviceId) return <Alert severity="info">{walkIn ? 'เลือกประเภทรถก่อน เพื่อดูเวลาที่ว่างวันนี้' : 'เลือกประเภทรถก่อน เพื่อดูวันและเวลาที่ว่าง'}</Alert>;

  const retry = <Button color="inherit" size="small" onClick={() => setReload((k) => k + 1)}>ลองใหม่</Button>;

  if (walkIn) {
    const day = meta.date ?? '';
    const regularShown = walkInShown.filter((s) => !s.overflow);
    const overflowShown = walkInShown.filter((s) => s.overflow);
    const last = meta.last_queue ?? null;
    const nothingLeft = slots !== null && summary.next === null;
    const renderSlot = (s: WalkInSlotView) => {
      const t = hhmm(s.slot_time);
      const selected = t === time;
      const { word, color } = walkInWord(s);
      // Third line: the running slot says so; more than one dock says how many are left.
      const detail = [s.in_progress ? 'กำลังเดิน' : null, s.capacity > 1 ? (s.bookable ? `ท่าว่าง ${s.remaining_capacity}/${s.capacity}` : `ท่าเต็ม ${s.capacity}/${s.capacity}`) : null].filter(Boolean).join(' · ');
      return (
        <Button
          key={s.slot_time}
          aria-label={`${t} ${word}${detail ? ` ${detail}` : ''}`}
          variant={selected ? 'contained' : 'outlined'}
          color={selected ? 'primary' : color}
          disabled={!s.bookable}
          onClick={() => onChange({ date: day, time: t, overflow: s.overflow })}
          sx={{ flexDirection: 'column', py: 1, lineHeight: 1.2, minHeight: 60, borderWidth: s.bookable && !selected ? 2 : 1, '&:hover': { borderWidth: s.bookable && !selected ? 2 : 1 } }}
        >
          <span style={{ fontWeight: 700, fontSize: 15 }}>{t}</span>
          <span style={{ fontWeight: 700, fontSize: 13 }}>{word}</span>
          {detail ? <span style={{ fontSize: 11, opacity: 0.75 }}>{detail}</span> : null}
        </Button>
      );
    };

    return (
      <Stack spacing={1.5}>
        <Typography variant="subtitle2" fontWeight={700}>เวลาว่างวันนี้{day ? ` — ${shortThaiDay(day)}` : ''}</Typography>
        {slotsError ? <Alert severity="error" action={retry}>{slotsError}</Alert> : null}
        {!slotsError && slots === null ? <Skeleton variant="rounded" height={120} /> : null}

        {slots !== null ? (
          <Paper variant="outlined" sx={{ p: 1.5, bgcolor: 'action.hover' }}>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center">
              {meta.now ? <Chip size="small" variant="outlined" label={`ตอนนี้ ${meta.now}`} /> : null}
              {summary.full
                ? <Chip size="small" color="warning" label="เวลาทำการเต็ม" />
                : <Chip size="small" color="success" label={`ว่าง ${summary.regular.length} ช่อง · เร็วสุด ${hhmm(summary.regular[0].slot_time)}`} />}
            </Stack>
            <Typography variant="body2" sx={{ mt: 1 }}>
              {last
                ? <>คิวสุดท้ายวันนี้ <b>{last.queue_number}</b> · {hhmm(last.start_time)}–{hhmm(last.end_time)}{last.resource_name ? ` · ${last.resource_name}` : ''}{last.free_from !== last.end_time ? ` · ท่าว่างตั้งแต่ ${hhmm(last.free_from)}` : ''}</>
                : 'วันนี้ยังไม่มีคิวสำหรับรถประเภทนี้'}
            </Typography>
            {summary.full && summary.next ? (
              <Typography variant="body2" color="warning.dark" sx={{ mt: 0.5, fontWeight: 600 }}>
                ช่องเวลาทำการเต็มแล้ว — ต่อท้ายคิวได้ตั้งแต่ {hhmm(summary.next.slot_time)}
              </Typography>
            ) : null}
            {nothingLeft ? (
              <Typography variant="body2" color="error.main" sx={{ mt: 0.5, fontWeight: 600 }}>
                วันนี้ต่อคิวไม่ได้แล้ว — ลองเปลี่ยนท่า หรือสร้างคิวของวันอื่นที่ปุ่ม &quot;สร้างคิว&quot;
              </Typography>
            ) : null}
          </Paper>
        ) : null}

        {slots !== null && walkInShown.length > 0 ? (
          <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
            <LegendItem color="success.main" label="ว่าง — แทรกได้เลย" />
            <LegendItem color="text.disabled" label="เต็ม" />
            {overflowShown.length > 0 ? <LegendItem color="warning.main" label="ต่อท้าย — หลังคิวสุดท้าย / เกินเวลาทำการ" /> : null}
          </Stack>
        ) : null}

        {regularShown.length > 0 ? (
          <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: 'repeat(auto-fill, minmax(104px, 1fr))' }}>
            {regularShown.map(renderSlot)}
          </Box>
        ) : null}

        {overflowShown.length > 0 ? (
          <Box>
            <Divider sx={{ my: 1 }}><Typography variant="caption" color="text.secondary">ต่อท้ายคิว (เกินเวลาทำการ)</Typography></Divider>
            <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: 'repeat(auto-fill, minmax(104px, 1fr))' }}>
              {overflowShown.map(renderSlot)}
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
              เวลาต่อท้ายเป็นเวลาโดยประมาณ — รถรอในลานและถูกเรียกเข้าท่าเมื่อท่าว่าง
            </Typography>
          </Box>
        ) : null}
      </Stack>
    );
  }

  return (
    <Stack spacing={2}>
      <Box>
        <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>วันที่ว่าง</Typography>
        {daysError ? <Alert severity="error" action={retry}>โหลดวันที่ว่างไม่สำเร็จ</Alert> : null}
        {!daysError && days === null ? <Skeleton variant="rounded" height={40} /> : null}
        {days && days.length === 0 ? <Alert severity="warning">ไม่มีวันว่างในช่วง 6 สัปดาห์ข้างหน้า — ตรวจเวลาทำการ วันหยุด และท่าที่รองรับประเภทรถนี้</Alert> : null}
        {days && days.length > 0 ? (
          <Stack direction="row" spacing={1} sx={{ overflowX: 'auto', pb: 1 }}>
            {days.map((d) => (
              <Chip
                key={d.day}
                clickable
                color={d.day === date ? 'primary' : 'default'}
                variant={d.day === date ? 'filled' : 'outlined'}
                label={`${shortThaiDay(d.day)} · ว่าง ${d.open_slots}`}
                onClick={() => onChange({ date: d.day, time: '' })}
                sx={{ flexShrink: 0, height: 36 }}
              />
            ))}
          </Stack>
        ) : null}
      </Box>

      {date ? (
        <Box>
          <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>เวลา — {shortThaiDay(date)}</Typography>
          {slotsError ? <Alert severity="error" action={retry}>{slotsError}</Alert> : null}
          {!slotsError && slots === null ? <Skeleton variant="rounded" height={88} /> : null}
          {slots && slots.length === 0 ? <Alert severity="warning">วันนี้ไม่มีช่วงเวลาให้จอง</Alert> : null}
          {slots && slots.length > 0 ? (
            <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: 'repeat(auto-fill, minmax(104px, 1fr))' }}>
              {slots.map((s) => {
                const t = hhmm(s.slot_time);
                const selected = t === time;
                return (
                  <Button
                    key={s.slot_time}
                    variant={selected ? 'contained' : 'outlined'}
                    color={selected ? 'primary' : 'inherit'}
                    disabled={!s.bookable}
                    onClick={() => onChange({ date, time: t })}
                    sx={{ flexDirection: 'column', py: 0.75, lineHeight: 1.2, minHeight: 48 }}
                  >
                    <span style={{ fontWeight: 700 }}>{t}–{hhmm(s.slot_end)}</span>
                    <span style={{ fontSize: 11, opacity: 0.8 }}>{slotHint(s)}</span>
                  </Button>
                );
              })}
            </Box>
          ) : null}
        </Box>
      ) : null}
    </Stack>
  );
}
