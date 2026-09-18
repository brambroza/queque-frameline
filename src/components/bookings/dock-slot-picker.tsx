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

/**
 * Date + time picker that only offers what can actually be booked: days with
 * an open slot for this vehicle type / direction, then that day's slots with
 * full and past ones disabled.
 */
export function DockSlotPicker({
  direction, serviceId, branchId, dockId, excludeBookingId, date, time, onChange,
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
}) {
  const [days, setDays] = useState<DayOption[] | null>(null);
  const [daysError, setDaysError] = useState(false);
  const [slots, setSlots] = useState<SlotOption[] | null>(null);
  const [slotsError, setSlotsError] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (!serviceId) return;
    const ctl = new AbortController();
    setDays(null);
    setDaysError(false);
    const dq = new URLSearchParams({ direction, service_id: serviceId });
    if (branchId) dq.set('branch_id', branchId);
    fetch(`/api/available-days?${dq}`, { cache: 'no-store', signal: ctl.signal })
      .then(async (r) => { const j = (await r.json()) as { data?: DayOption[] }; if (!r.ok) throw new Error(); setDays(j.data ?? []); })
      .catch(() => { if (!ctl.signal.aborted) setDaysError(true); });
    return () => ctl.abort();
  }, [direction, serviceId, branchId, reload]);

  useEffect(() => {
    if (!serviceId || !date) { setSlots(null); return; }
    const ctl = new AbortController();
    setSlots(null);
    setSlotsError(false);
    const qs = new URLSearchParams({ direction, service_id: serviceId, date });
    if (branchId) qs.set('branch_id', branchId);
    if (dockId) qs.set('resource_id', dockId);
    if (excludeBookingId) qs.set('exclude_booking_id', excludeBookingId);
    fetch(`/api/available-slots?${qs}`, { cache: 'no-store', signal: ctl.signal })
      .then(async (r) => { const j = (await r.json()) as { data?: SlotOption[] }; if (!r.ok) throw new Error(); setSlots(j.data ?? []); })
      .catch(() => { if (!ctl.signal.aborted) setSlotsError(true); });
    return () => ctl.abort();
  }, [direction, serviceId, branchId, dockId, excludeBookingId, date, reload]);

  if (!serviceId) return <Alert severity="info">เลือกประเภทรถก่อน เพื่อดูวันและเวลาที่ว่าง</Alert>;

  return (
    <Stack spacing={2}>
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

      {date ? (
        <Box>
          <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>เวลา — {shortThaiDay(date)}</Typography>
          {slotsError ? <Alert severity="error" action={<Button color="inherit" size="small" onClick={() => setReload((k) => k + 1)}>ลองใหม่</Button>}>โหลดช่วงเวลาไม่สำเร็จ</Alert> : null}
          {!slotsError && slots === null ? <Skeleton variant="rounded" height={88} /> : null}
          {slots && slots.length === 0 ? <Alert severity="warning">วันนี้ไม่มีช่วงเวลาให้จอง</Alert> : null}
          {slots && slots.length > 0 ? (
            <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: 'repeat(auto-fill, minmax(104px, 1fr))' }}>
              {slots.map((s) => {
                const t = hhmm(s.slot_time);
                const selected = t === time;
                const hint = s.is_past ? 'ผ่านแล้ว' : s.remaining_capacity <= 0 ? `เต็ม ${s.capacity}/${s.capacity}` : `ว่าง ${s.remaining_capacity}/${s.capacity}`;
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
                    <span style={{ fontSize: 11, opacity: 0.8 }}>{hint}</span>
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
