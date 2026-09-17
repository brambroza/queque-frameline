/**
 * Booking reminder settings + scheduling window.
 *
 * A shop opts in (`shops.reminder_enabled`, default off) and picks a lead time
 * (`shops.reminder_minutes`). Every few minutes the cron asks, per shop, which
 * bookings start inside `[now, now + lead]` and have not been reminded yet.
 *
 * Booking times are stored as `booking_date date` + `start_time time` in the
 * shop's local (Bangkok) clock with no zone, so the window is computed in
 * Asia/Bangkok too and compared as plain date/time strings.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

/** Smallest lead time the DB check constraint allows. */
export const REMINDER_MINUTES_MIN = 5;
/** Largest lead time the DB check constraint allows (7 days). */
export const REMINDER_MINUTES_MAX = 10080;
/** Lead time used when a shop enables reminders without choosing one. */
export const REMINDER_MINUTES_DEFAULT = 60;

/** Lead-time presets offered in the portal, in minutes. */
export const REMINDER_PRESETS = [15, 30, 60, 120, 180, 1440] as const;
export type ReminderPreset = (typeof REMINDER_PRESETS)[number];

/**
 * Thai label for a lead time, e.g. 90 → "1 ชั่วโมง 30 นาที".
 *
 * @param minutes - Lead time in minutes.
 * @returns Human-readable Thai label.
 */
export function reminderLeadLabel(minutes: number): string {
  if (minutes >= 1440 && minutes % 1440 === 0) return `${minutes / 1440} วัน`;
  if (minutes >= 60 && minutes % 60 === 0) return `${minutes / 60} ชั่วโมง`;
  if (minutes > 60) return `${Math.floor(minutes / 60)} ชั่วโมง ${minutes % 60} นาที`;
  return `${minutes} นาที`;
}

export type ReminderSettings = { enabled: boolean; minutes: number };

/**
 * Read a shop's reminder settings without letting a missing column break the
 * caller. Until migration 202609120004 has run the query errors, and this is
 * read on the LINE settings page — so a failure resolves to "off".
 *
 * @param client - Supabase client already scoped to read this shop.
 * @param shopId - Shop to read.
 * @returns Enabled flag + lead time in minutes.
 */
export async function getReminderSettings(client: SupabaseClient, shopId: string): Promise<ReminderSettings> {
  const { data, error } = await client
    .from('shops')
    .select('reminder_enabled,reminder_minutes')
    .eq('id', shopId)
    .maybeSingle();
  if (error || !data) return { enabled: false, minutes: REMINDER_MINUTES_DEFAULT };
  const row = data as { reminder_enabled?: boolean | null; reminder_minutes?: number | null };
  const minutes = Number(row.reminder_minutes);
  return {
    enabled: row.reminder_enabled === true,
    minutes: Number.isFinite(minutes) && minutes >= REMINDER_MINUTES_MIN ? minutes : REMINDER_MINUTES_DEFAULT,
  };
}

/** A point in Bangkok local time as the strings the DB stores. */
export type LocalStamp = { date: string; time: string };

/**
 * Convert an instant to Bangkok-local `YYYY-MM-DD` + `HH:MM:SS`.
 *
 * @param at - Instant to convert.
 * @returns Local date and time strings, matching `booking_date` / `start_time`.
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
    hour12: false,
  }).formatToParts(at);
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  // Intl can render midnight as "24" in some engines.
  const hour = map.hour === '24' ? '00' : map.hour;
  return {
    date: `${map.year}-${map.month}-${map.day}`,
    time: `${hour}:${map.minute}:${map.second}`,
  };
}

/**
 * Bookings that should be reminded on this tick: those starting from now up to
 * `minutes` ahead. The window may cross midnight, so it is returned as two
 * local stamps; callers match `(booking_date, start_time)` between them.
 *
 * @param now - Current instant.
 * @param minutes - Shop lead time.
 * @returns Inclusive lower bound and exclusive upper bound in Bangkok time.
 */
export function computeReminderWindow(now: Date, minutes: number): { from: LocalStamp; to: LocalStamp } {
  const lead = Math.min(Math.max(Math.trunc(minutes), REMINDER_MINUTES_MIN), REMINDER_MINUTES_MAX);
  const end = new Date(now.getTime() + lead * 60_000);
  return { from: toBangkokStamp(now), to: toBangkokStamp(end) };
}

/**
 * Whether a booking's local start lies inside `[from, to)`.
 *
 * @param booking - Stored date + time strings.
 * @param window - Result of {@link computeReminderWindow}.
 * @returns true when the booking should be reminded now.
 */
export function isInReminderWindow(booking: LocalStamp, window: { from: LocalStamp; to: LocalStamp }): boolean {
  const key = (s: LocalStamp) => `${s.date}T${String(s.time).slice(0, 8).padEnd(8, '0')}`;
  const k = key(booking);
  return k >= key(window.from) && k < key(window.to);
}
