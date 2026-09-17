import { addDays, daysBetween, endOfMonth, startOfMonth, startOfWeekMonday } from '@/lib/dashboard/date-range';

/**
 * Report range presets. Unlike the dashboard these look forward as well as
 * back, so a shop can print tomorrow's queue sheet or analyse last month.
 */
export type ReportPreset = 'today' | 'tomorrow' | 'next7' | 'week' | 'month' | 'last7' | 'last30' | 'custom';

export const REPORT_PRESETS: ReportPreset[] = ['today', 'tomorrow', 'next7', 'week', 'month', 'last7', 'last30', 'custom'];

/** Longest range a single report request will aggregate. */
export const REPORT_MAX_DAYS = 92;

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

export type ReportRange = { preset: ReportPreset; from: string; to: string; days: number };

/**
 * Whether a string is a well-formed ISO `YYYY-MM-DD` date.
 */
export function isISODate(value: string | null | undefined): value is string {
  return typeof value === 'string' && ISO_RE.test(value) && !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime());
}

/**
 * Whether the value is one of the known presets.
 */
export function isReportPreset(value: string | null | undefined): value is ReportPreset {
  return REPORT_PRESETS.includes(value as ReportPreset);
}

/**
 * Resolve a preset (or a custom pair) into concrete inclusive bounds.
 *
 * - `today` / `tomorrow` → that single day
 * - `next7`  → today through the next 6 days (upcoming queue)
 * - `week`   → Monday–Sunday of the current week
 * - `month`  → 1st–last day of the current month
 * - `last7` / `last30` → the N days ending today (analysis)
 * - `custom` → `[from, to]`, swapped when reversed, capped at `REPORT_MAX_DAYS`
 *
 * @throws Error when custom bounds are missing/invalid or exceed the cap.
 */
export function resolveReportRange(preset: ReportPreset, today: string, from?: string | null, to?: string | null): ReportRange {
  let f: string;
  let t: string;
  switch (preset) {
    case 'today':
      f = today;
      t = today;
      break;
    case 'tomorrow':
      f = addDays(today, 1);
      t = f;
      break;
    case 'next7':
      f = today;
      t = addDays(today, 6);
      break;
    case 'week':
      f = startOfWeekMonday(today);
      t = addDays(f, 6);
      break;
    case 'month':
      f = startOfMonth(today);
      t = endOfMonth(today);
      break;
    case 'last7':
      t = today;
      f = addDays(today, -6);
      break;
    case 'last30':
      t = today;
      f = addDays(today, -29);
      break;
    default: {
      if (!isISODate(from) || !isISODate(to)) throw new Error('Custom range requires from and to');
      f = from;
      t = to;
      if (t < f) [f, t] = [t, f];
      if (daysBetween(f, t) > REPORT_MAX_DAYS) throw new Error(`Range too long (max ${REPORT_MAX_DAYS} days)`);
    }
  }
  return { preset, from: f, to: t, days: daysBetween(f, t) };
}
