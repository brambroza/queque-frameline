import { describe, expect, it } from 'vitest';
import { buildInsights, pct, type HourCell, type InsightInput, type WeekdayHourStat, type WeekdayStat } from './insights';

const TODAY = '2026-09-12'; // Saturday
const HOURS = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19];

function cells(counts: Partial<Record<number, number>>, capacity = 6): HourCell[] {
  return HOURS.map((hour) => ({ hour, count: counts[hour] ?? 0, capacity }));
}

function pattern(pcts: number[]): WeekdayStat[] {
  return pcts.map((p, weekday) => ({ weekday, avg_count: 0, avg_utilization_pct: p, weeks: 8 }));
}

function weekdayHour(peak?: { weekday: number; hour: number; pct: number }): WeekdayHourStat[] {
  const out: WeekdayHourStat[] = [];
  for (let w = 0; w < 7; w++) for (const h of HOURS) out.push({ weekday: w, hour: h, avg_utilization_pct: 50, samples: 8 });
  if (peak) {
    const cell = out.find((c) => c.weekday === peak.weekday && c.hour === peak.hour);
    if (cell) cell.avg_utilization_pct = peak.pct;
  }
  return out;
}

function base(overrides: Partial<InsightInput> = {}): InsightInput {
  return {
    today: TODAY,
    now_hour: 14,
    by_day: [{ date: TODAY, count: 40, capacity: 60, is_holiday: false }],
    hours_by_date: new Map([[TODAY, cells({ 10: 4, 11: 6, 12: 6, 13: 4, 14: 4, 15: 4, 16: 4, 17: 4, 18: 2, 19: 2 })]]),
    weekday_pattern: pattern([80, 70, 65, 70, 72, 78, 85]),
    weekday_hour: weekdayHour(),
    kpi: { total: 40, cancelled: 2, no_show: 1 },
    prev_kpi: { total: 42, cancelled: 3, no_show: 1 },
    ...overrides,
  };
}

describe('pct', () => {
  it('rounds and guards zero denominators', () => {
    expect(pct(1, 3)).toBe(33);
    expect(pct(5, 0)).toBe(0);
  });
});

describe('buildInsights', () => {
  it('returns nothing when everything is normal', () => {
    expect(buildInsights(base())).toEqual([]);
  });

  it('flags the busiest weekday×hour when it is at least 80 %', () => {
    const out = buildInsights(base({ weekday_hour: weekdayHour({ weekday: 6, hour: 17, pct: 92 }) }));
    expect(out).toContainEqual({ kind: 'peak', severity: 'info', weekday: 6, hour: 17, utilization_pct: 92 });
  });

  it('flags a low day with its longest free run after the current hour', () => {
    const out = buildInsights(
      base({
        by_day: [{ date: TODAY, count: 12, capacity: 60, is_holiday: false }],
        hours_by_date: new Map([[TODAY, cells({ 10: 3, 11: 4, 12: 3, 13: 0, 14: 0, 15: 1, 16: 0, 17: 1, 18: 0, 19: 0 })]]),
      }),
    );
    const low = out.find((i) => i.kind === 'low');
    expect(low).toMatchObject({ date: TODAY, weekday: 6, utilization_pct: 20, baseline_pct: 85, free_from_hour: 14, free_to_hour: 20, free_slots: 34 });
  });

  it('skips holidays, future days and days that are merely quiet for their weekday', () => {
    const out = buildInsights(
      base({
        by_day: [
          { date: '2026-09-07', count: 0, capacity: 0, is_holiday: true },
          { date: '2026-09-13', count: 5, capacity: 60, is_holiday: false },
          { date: '2026-09-08', count: 20, capacity: 60, is_holiday: false }, // Tue 33 % vs 65 % baseline → gap 32 → flagged
        ],
        hours_by_date: new Map([['2026-09-08', cells({})]]),
      }),
    );
    expect(out.filter((i) => i.kind === 'low')).toHaveLength(1);
    expect(out.find((i) => i.kind === 'low')).toMatchObject({ date: '2026-09-08' });
  });

  it('suggests moving queue from an over-capacity hour tomorrow to free hours today', () => {
    const tomorrow = '2026-09-13';
    const out = buildInsights(
      base({
        hours_by_date: new Map([
          [TODAY, cells({ 10: 4, 11: 6, 12: 6, 13: 4, 14: 4, 15: 1, 16: 0, 17: 1, 18: 5, 19: 5 })],
          [tomorrow, cells({ 11: 9 })],
        ]),
      }),
    );
    expect(out.find((i) => i.kind === 'movable')).toMatchObject({ date: tomorrow, hour: 11, count: 9, capacity: 6, target_date: TODAY, target_from_hour: 15, target_to_hour: 18 });
  });

  it('lists at most two chronically quiet weekdays', () => {
    const out = buildInsights(base({ weekday_pattern: pattern([70, 45, 30, 48, 70, 70, 80]) }));
    expect(out.find((i) => i.kind === 'pattern')).toMatchObject({ weekdays: [2, 1], utilization_pcts: [30, 45], weeks: 8 });
  });

  it('flags a high cancel rate or a jump versus the previous period', () => {
    const high = buildInsights(base({ kpi: { total: 40, cancelled: 6, no_show: 2 } }));
    expect(high.find((i) => i.kind === 'cancel_rate')).toMatchObject({ rate_pct: 20 });

    const jump = buildInsights(base({ kpi: { total: 40, cancelled: 4, no_show: 1 }, prev_kpi: { total: 40, cancelled: 1, no_show: 1 } }));
    expect(jump.find((i) => i.kind === 'cancel_rate')).toMatchObject({ rate_pct: 13, prev_rate_pct: 5 });

    const tooFew = buildInsights(base({ kpi: { total: 5, cancelled: 3, no_show: 0 } }));
    expect(tooFew.find((i) => i.kind === 'cancel_rate')).toBeUndefined();
  });

  it('handles an empty range', () => {
    expect(
      buildInsights(base({ by_day: [], hours_by_date: new Map(), weekday_pattern: [], weekday_hour: [], kpi: { total: 0, cancelled: 0, no_show: 0 }, prev_kpi: { total: 0, cancelled: 0, no_show: 0 } })),
    ).toEqual([]);
  });
});
