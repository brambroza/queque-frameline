/**
 * "Has this slot already started?" — shared by the public slots list (to grey
 * a slot out) and the public book endpoint (to refuse it), so the LIFF grid
 * and the server never disagree.
 *
 * Booking dates and times are Bangkok-local strings with no zone, so the
 * comparison is done on Bangkok-local strings too (see `toBangkokStamp`).
 * The device clock is never trusted: both callers pass a server-side `now`.
 */
import type { LocalStamp } from '@/lib/line/booking-reminder';

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
