'use client';

import { useEffect, useState } from 'react';
import { Alert, Box, Button, Chip, Skeleton, Stack, Typography } from '@mui/material';
import type { BookingDirection } from '@/types/db';
import { hhmm, type SlotOption } from './booking-types';

type DayOption = { day: string; open_slots: number };

const WEEKDAY = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
const MONTH = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

/** "จ. 21 ก.ย." from an ISO date, without timezone drift. */
export function shortThaiDay(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${WEEKDAY[dow]} ${d} ${MONTH[m - 1]}`;
}

/** Line under the time on a slot button. */
function slotHint(s: SlotOption): string {
  if (s.is_past) return 'ผ่านแล้ว';
  if (s.remaining_capacity <= 0) return `เต็ม ${s.capacity}/${s.capacity}`;
  const free = `ว่าง ${s.remaining_capacity}/${s.capacity}`;
  return s.in_progress ? `กำลังเดิน · ${free}` : free;
}

/**
 * Date + time picker that only offers what can actually be booked: days with
 * an open slot for this vehicle type / direction, then that day's slots with
 * full and past ones disabled.
 *
 * `walkIn` = the truck is already on site: no day to choose (the server picks
 * today), finished slots are left out and the slot running now may be taken.
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
  onChange: (next: { date: string; time: string }) => void;
  /** Walk-in mode: today's slots only, including the one in progress. `date` is ignored. */
  walkIn?: boolean;
  /** Bump to refetch the slots, e.g. after the server refused the chosen one. */
  refreshKey?: number;
}) {
  const [days, setDays] = useState<DayOption[] | null>(null);
  const [daysError, setDaysError] = useState(false);
  const [slots, setSlots] = useState<SlotOption[] | null>(null);
  const [slotsError, setSlotsError] = useState(false);
  const [reload, setReload] = useState(0);
  /** Walk-in: the day the server used (its "today"). */
  const [serverDay, setServerDay] = useState('');

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
    setSlotsError(false);
    const qs = new URLSearchParams({ direction, service_id: serviceId });
    if (walkIn) qs.set('walk_in', '1');
    else qs.set('date', queryDate);
    if (branchId) qs.set('branch_id', branchId);
    if (dockId) qs.set('resource_id', dockId);
    if (excludeBookingId) qs.set('exclude_booking_id', excludeBookingId);
    fetch(`/api/available-slots?${qs}`, { cache: 'no-store', signal: ctl.signal })
      .then(async (r) => {
        const j = (await r.json()) as { data?: SlotOption[]; meta?: { date?: string } };
        if (!r.ok) throw new Error();
        setSlots(j.data ?? []);
        setServerDay(j.meta?.date ?? '');
      })
      .catch(() => { if (!ctl.signal.aborted) setSlotsError(true); });
    return () => ctl.abort();
  }, [direction, serviceId, branchId, dockId, excludeBookingId, queryDate, walkIn, reload, refreshKey]);

  if (!serviceId) return <Alert severity="info">{walkIn ? 'เลือกประเภทรถก่อน เพื่อดูเวลาที่ว่างวันนี้' : 'เลือกประเภทรถก่อน เพื่อดูวันและเวลาที่ว่าง'}</Alert>;

  const day = walkIn ? serverDay : date;
  const shown = walkIn ? (slots ?? []).filter((s) => !s.is_past) : slots ?? [];
  const noneFree = walkIn && slots !== null && !shown.some((s) => s.bookable);

  return (
    <Stack spacing={2}>
      {!walkIn ? (
        <Box>
          <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>วันที่ว่าง</Typography>
          {daysError ? <Alert severity="error" action={<Button color="inherit" size="small" onClick={() => setReload((k) => k + 1)}>ลองใหม่</Button>}>โหลดวันที่ว่างไม่สำเร็จ</Alert> : null}
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
      ) : null}

      {walkIn || date ? (
        <Box>
          <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>{walkIn ? 'เวลาว่างวันนี้' : 'เวลา'}{day ? ` — ${shortThaiDay(day)}` : ''}</Typography>
          {slotsError ? <Alert severity="error" action={<Button color="inherit" size="small" onClick={() => setReload((k) => k + 1)}>ลองใหม่</Button>}>โหลดช่วงเวลาไม่สำเร็จ</Alert> : null}
          {!slotsError && slots === null ? <Skeleton variant="rounded" height={88} /> : null}
          {slots && !walkIn && slots.length === 0 ? <Alert severity="warning">วันนี้ไม่มีช่วงเวลาให้จอง</Alert> : null}
          {noneFree ? <Alert severity="warning">วันนี้ไม่เหลือช่วงเวลาว่างสำหรับรถประเภทนี้ — ลองเปลี่ยนท่า หรือสร้างคิวของวันอื่นที่ปุ่ม &quot;สร้างคิว&quot;</Alert> : null}
          {slots && shown.length > 0 ? (
            <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: 'repeat(auto-fill, minmax(104px, 1fr))' }}>
              {shown.map((s) => {
                const t = hhmm(s.slot_time);
                const selected = t === time;
                return (
                  <Button
                    key={s.slot_time}
                    variant={selected ? 'contained' : 'outlined'}
                    color={selected ? 'primary' : s.in_progress && s.bookable ? 'success' : 'inherit'}
                    disabled={!s.bookable}
                    onClick={() => onChange({ date: day, time: t })}
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
