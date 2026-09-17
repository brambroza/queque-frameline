import { addDays, weekdayOf } from './date-range';

/**
 * Rule-based manager insights. Pure function over already-aggregated numbers so it
 * can be unit-tested without a database; the client turns each `Insight` into
 * localized copy from its `kind` + fields.
 */

export type DayStat = { date: string; count: number; capacity: number; is_holiday: boolean };
export type HourCell = { hour: number; count: number; capacity: number };
export type WeekdayStat = { weekday: number; avg_count: number; avg_utilization_pct: number; weeks: number };
export type WeekdayHourStat = { weekday: number; hour: number; avg_utilization_pct: number; samples: number };

export type Insight =
  | { kind: 'peak'; severity: 'info'; weekday: number; hour: number; utilization_pct: number }
  | {
      kind: 'low';
      severity: 'warning';
      date: string;
      weekday: number;
      utilization_pct: number;
      baseline_pct: number;
      free_from_hour: number | null;
      free_to_hour: number | null;
      free_slots: number;
      link: string;
    }
  | {
      kind: 'movable';
      severity: 'info';
      date: string;
      hour: number;
      count: number;
      capacity: number;
      target_date: string;
      target_from_hour: number | null;
      target_to_hour: number | null;
      link: string;
    }
  | { kind: 'pattern'; severity: 'info'; weekdays: number[]; utilization_pcts: number[]; weeks: number }
  | { kind: 'cancel_rate'; severity: 'error'; rate_pct: number; prev_rate_pct: number; link: string };

export type InsightInput = {
  today: string;
  /** Hour of day in Asia/Bangkok at request time. */
  now_hour: number;
  by_day: DayStat[];
  /** Hourly cells for every date in `by_day` plus the next three days after today. */
  hours_by_date: Map<string, HourCell[]>;
  weekday_pattern: WeekdayStat[];
  weekday_hour: WeekdayHourStat[];
  kpi: { total: number; cancelled: number; no_show: number };
  prev_kpi: { total: number; cancelled: number; no_show: number };
};

export const THRESHOLDS = {
  peak_min_pct: 80,
  low_max_pct: 40,
  low_gap_pts: 25,
  free_cell_max_ratio: 0.34,
  pattern_max_pct: 50,
  cancel_rate_pct: 15,
  cancel_jump_pts: 5,
  min_bookings_for_cancel: 10,
} as const;

/** Percentage rounded to an integer; 0 when the denominator is 0. */
export function pct(num: number, den: number): number {
  return den > 0 ? Math.round((num / den) * 100) : 0;
}

/** Longest run of consecutive hours where booked ≤ ratio × capacity. */
function longestFreeRun(cells: HourCell[], ratio: number, fromHour = -1): HourCell[] {
  let run: HourCell[] = [];
  let best: HourCell[] = [];
  for (const c of cells) {
    const eligible = c.capacity > 0 && c.hour >= fromHour && c.count <= c.capacity * ratio;
    if (eligible) {
      run.push(c);
      if (run.length > best.length) best = run;
    } else {
      run = [];
    }
  }
  return best;
}

/**
 * Build the insight list. Rules, in order of appearance:
 * 1. peak      — busiest weekday×hour over the 8-week pattern, if ≥ 80 %.
 * 2. low       — first day in range that is < 40 % and ≥ 25 pts below its weekday average.
 * 3. movable   — first of the next three days with an hour at/over capacity, paired
 *                with free hours on the low day (or today).
 * 4. pattern   — up to two weekdays averaging < 50 %.
 * 5. cancel    — cancel+no-show rate > 15 % or ≥ 5 pts worse than the previous period.
 */
export function buildInsights(input: InsightInput): Insight[] {
  const out: Insight[] = [];
  const patternByWeekday = new Map(input.weekday_pattern.map((p) => [p.weekday, p]));

  // 1. peak
  let peak: WeekdayHourStat | null = null;
  for (const cell of input.weekday_hour) {
    if (cell.samples === 0) continue;
    if (!peak || cell.avg_utilization_pct > peak.avg_utilization_pct) peak = cell;
  }
  if (peak && peak.avg_utilization_pct >= THRESHOLDS.peak_min_pct) {
    out.push({ kind: 'peak', severity: 'info', weekday: peak.weekday, hour: peak.hour, utilization_pct: peak.avg_utilization_pct });
  }

  // 2. low
  let lowDay: DayStat | null = null;
  for (const d of input.by_day) {
    if (d.is_holiday || d.capacity === 0 || d.date > input.today) continue;
    const u = pct(d.count, d.capacity);
    const base = patternByWeekday.get(weekdayOf(d.date))?.avg_utilization_pct ?? 0;
    if (u < THRESHOLDS.low_max_pct && base - u >= THRESHOLDS.low_gap_pts) {
      const cells = input.hours_by_date.get(d.date) ?? [];
      const run = longestFreeRun(cells, THRESHOLDS.free_cell_max_ratio, d.date === input.today ? input.now_hour : -1);
      out.push({
        kind: 'low',
        severity: 'warning',
        date: d.date,
        weekday: weekdayOf(d.date),
        utilization_pct: u,
        baseline_pct: base,
        free_from_hour: run.length ? run[0].hour : null,
        free_to_hour: run.length ? run[run.length - 1].hour + 1 : null,
        free_slots: run.reduce((s, c) => s + c.capacity - c.count, 0),
        link: `/portal/bookings?date=${d.date}`,
      });
      lowDay = d;
      break;
    }
  }

  // 3. movable
  const targetDate = lowDay && lowDay.date >= input.today ? lowDay.date : input.today;
  for (let i = 1; i <= 3; i++) {
    const date = addDays(input.today, i);
    const cells = input.hours_by_date.get(date) ?? [];
    const over = cells.find((c) => c.capacity > 0 && c.count >= c.capacity);
    if (!over) continue;
    const targetCells = input.hours_by_date.get(targetDate) ?? [];
    const free = longestFreeRun(targetCells, 0.5, targetDate === input.today ? input.now_hour + 1 : -1);
    out.push({
      kind: 'movable',
      severity: 'info',
      date,
      hour: over.hour,
      count: over.count,
      capacity: over.capacity,
      target_date: targetDate,
      target_from_hour: free.length ? free[0].hour : null,
      target_to_hour: free.length ? free[free.length - 1].hour + 1 : null,
      link: `/portal/bookings?date=${date}`,
    });
    break;
  }

  // 4. pattern
  const lows = input.weekday_pattern
    .filter((p) => p.weeks > 0 && p.avg_utilization_pct < THRESHOLDS.pattern_max_pct)
    .sort((a, b) => a.avg_utilization_pct - b.avg_utilization_pct)
    .slice(0, 2);
  if (lows.length) {
    out.push({
      kind: 'pattern',
      severity: 'info',
      weekdays: lows.map((p) => p.weekday),
      utilization_pcts: lows.map((p) => p.avg_utilization_pct),
      weeks: Math.max(...lows.map((p) => p.weeks)),
    });
  }

  // 5. cancel rate
  const rate = pct(input.kpi.cancelled + input.kpi.no_show, input.kpi.total);
  const prevRate = pct(input.prev_kpi.cancelled + input.prev_kpi.no_show, input.prev_kpi.total);
  if (
    input.kpi.total >= THRESHOLDS.min_bookings_for_cancel &&
    (rate > THRESHOLDS.cancel_rate_pct || rate - prevRate >= THRESHOLDS.cancel_jump_pts)
  ) {
    out.push({ kind: 'cancel_rate', severity: 'error', rate_pct: rate, prev_rate_pct: prevRate, link: '/portal/bookings' });
  }

  return out.slice(0, 5);
}
