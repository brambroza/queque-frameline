/**
 * "Has this slot already started?" — shared by the public slots list (to grey
 * a slot out) and the public book endpoint (to refuse it), so the LIFF grid
 * and the server never disagree.
 *
 * Booking dates and times are Bangkok-local strings with no zone, so the
 * comparison is done on Bangkok-local strings too (see `toBangkokStamp`).
 * The device clock is never trusted: both callers pass a server-side `now`.
 */
/** A point in Bangkok local time as the strings the DB stores (`booking_date` / `start_time`). */
export type LocalStamp = { date: string; time: string };

/** Machine-readable code on the 400 from `/book`, so the LIFF can reload the grid. */
export const SLOT_PAST_CODE = 'slot_past';

/** Customer-facing message when the chosen slot has already started. */
export const SLOT_PAST_MESSAGE = 'ช่วงเวลานี้ผ่านไปแล้ว กรุณาเลือกเวลาใหม่';

/** Hint when every slot of the selected day has already started. */
export const DAY_OVER_HINT = 'หมดเวลาจองสำหรับวันนี้แล้ว';

/** Hint when the selected date is before today. */
export const DATE_PAST_HINT = 'วันที่เลือกผ่านไปแล้ว กรุณาเลือกวันใหม่';

/**
 * Normalise `HH:MM` / `HH:MM:SS` to `HH:MM:SS` so string comparison is safe.
 *
 * @param time - Time string from the client or the DB.
 * @returns Eight-character `HH:MM:SS`.
 */
export function normalizeSlotTime(time: string): string {
  const trimmed = time.trim();
  if (/^\d{2}:\d{2}$/.test(trimmed)) return `${trimmed}:00`;
  return trimmed.slice(0, 8);
}

/**
 * A slot is past once its start time is strictly before `now` in Bangkok
 * local time. A slot starting exactly now is still bookable. Any date before
 * today is past regardless of time.
 *
 * @param slot - Booking date `YYYY-MM-DD` and start time `HH:MM[:SS]`.
 * @param now - Server-side Bangkok stamp from `toBangkokStamp`.
 * @returns `true` when the slot has already started.
 */
export function isSlotPast(slot: { date: string; time: string }, now: LocalStamp): boolean {
  if (slot.date < now.date) return true;
  if (slot.date > now.date) return false;
  return normalizeSlotTime(slot.time) < normalizeSlotTime(now.time);
}

/**
 * Convert an instant to Bangkok-local `YYYY-MM-DD` + `HH:MM:SS`, matching how
 * `booking_date` / `start_time` are stored.
 *
 * @param at Instant to convert (server clock).
 */
export function toBangkokStamp(at: Date): LocalStamp {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(at);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00';
  return { date: `${get('year')}-${get('month')}-${get('day')}`, time: `${get('hour')}:${get('minute')}:${get('second')}` };
}

/** Add days to an ISO date (UTC arithmetic, no DST surprises). */
export function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export type SlotRow = { slot_time: string; slot_end: string; capacity: number; booked_count: number; remaining_capacity: number };
export type SlotView = SlotRow & { is_past: boolean; too_soon: boolean; bookable: boolean };

/**
 * Decorate RPC slots for a UI: past, inside the minimum lead time, bookable.
 *
 * @param date Day the slots belong to.
 * @param rows Output of `get_dock_slots`.
 * @param now Server clock.
 * @param leadHours Minimum notice customers must give (0 for staff).
 */
export function decorateSlots(date: string, rows: SlotRow[], now: Date, leadHours: number): SlotView[] {
  const stamp = toBangkokStamp(now);
  const earliest = now.getTime() + Math.max(leadHours, 0) * 3_600_000;
  return rows.map((r) => {
    const isPast = isSlotPast({ date, time: r.slot_time }, stamp);
    const startMs = new Date(`${date}T${normalizeSlotTime(r.slot_time)}+07:00`).getTime();
    const tooSoon = !isPast && startMs < earliest;
    return { ...r, is_past: isPast, too_soon: tooSoon, bookable: !isPast && !tooSoon && r.remaining_capacity > 0 };
  });
}
