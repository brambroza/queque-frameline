/**
 * Calendar-range helpers for the dashboard.
 *
 * All dates are ISO `YYYY-MM-DD` strings and the arithmetic is done in UTC on those
 * strings, so the result never depends on the server's local timezone. "Today" is
 * resolved in Asia/Bangkok by the caller (see `getTodayISOInBangkok`).
 */

export type RangeKind = 'today' | 'week' | 'month' | 'custom';

export type ResolvedRange = {
  kind: RangeKind;
  from: string;
  to: string;
  /** Previous period of equal length, ending the day before `from`. */
  prev_from: string;
  prev_to: string;
  /** Number of calendar days in `[from, to]`. */
  days: number;
};

/** Longest custom range the dashboard will aggregate in one request. */
export const MAX_RANGE_DAYS = 92;

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Parse an ISO date as UTC midnight. Throws on malformed input. */
export function parseISODate(iso: string): Date {
  if (!ISO_RE.test(iso)) throw new Error(`Invalid date: ${iso}`);
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) throw new Error(`Invalid date: ${iso}`);
  return d;
}

/** Format a UTC date as ISO `YYYY-MM-DD`. */
export function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Add (or subtract) whole days to an ISO date. */
export function addDays(iso: string, days: number): string {
  const d = parseISODate(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return toISODate(d);
}

/** Inclusive day count between two ISO dates. */
export function daysBetween(from: string, to: string): number {
  return Math.round((parseISODate(to).getTime() - parseISODate(from).getTime()) / 86_400_000) + 1;
}

/** Weekday of an ISO date, 0 = Sunday … 6 = Saturday (matches PG `extract(dow)`). */
export function weekdayOf(iso: string): number {
  return parseISODate(iso).getUTCDay();
}

/** Every ISO date from `from` to `to` inclusive. */
export function eachDay(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

/** Monday of the week containing `iso`. */
export function startOfWeekMonday(iso: string): string {
  const offset = (weekdayOf(iso) + 6) % 7;
  return addDays(iso, -offset);
}

/** First day of the month containing `iso`. */
export function startOfMonth(iso: string): string {
  return `${iso.slice(0, 8)}01`;
}

/** Last day of the month containing `iso`. */
export function endOfMonth(iso: string): string {
  const d = parseISODate(startOfMonth(iso));
  d.setUTCMonth(d.getUTCMonth() + 1);
  d.setUTCDate(0);
  return toISODate(d);
}

/**
 * Resolve the requested range into concrete bounds plus the comparison period.
 *
 * - `today`  → today only; compared with the same weekday one week earlier.
 * - `week`   → Monday–Sunday of the current week; compared with the previous week.
 * - `month`  → 1st–last day of the current month; compared with the previous month.
 * - `custom` → `[from, to]` as given (swapped if reversed); compared with the
 *              equal-length period immediately before it.
 *
 * @throws Error when custom bounds are missing/invalid or exceed `MAX_RANGE_DAYS`.
 */
export function resolveRange(kind: RangeKind, today: string, from?: string | null, to?: string | null): ResolvedRange {
  let f: string;
  let t: string;
  let pf: string;
  let pt: string;

  if (kind === 'today') {
    f = today;
    t = today;
    pf = addDays(today, -7);
    pt = pf;
  } else if (kind === 'week') {
    f = startOfWeekMonday(today);
    t = addDays(f, 6);
    pf = addDays(f, -7);
    pt = addDays(f, -1);
  } else if (kind === 'month') {
    f = startOfMonth(today);
    t = endOfMonth(today);
    pt = addDays(f, -1);
    pf = startOfMonth(pt);
  } else {
    if (!from || !to) throw new Error('Custom range requires from and to');
    f = from;
    t = to;
    parseISODate(f);
    parseISODate(t);
    if (t < f) [f, t] = [t, f];
    const n = daysBetween(f, t);
    if (n > MAX_RANGE_DAYS) throw new Error(`Range too long (max ${MAX_RANGE_DAYS} days)`);
    pt = addDays(f, -1);
    pf = addDays(f, -n);
  }

  return { kind, from: f, to: t, prev_from: pf, prev_to: pt, days: daysBetween(f, t) };
}
