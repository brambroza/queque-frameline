import { describe, expect, it } from 'vitest';
import { addDays, daysBetween, eachDay, endOfMonth, resolveRange, startOfWeekMonday, weekdayOf } from './date-range';

const TODAY = '2026-09-12'; // Saturday

describe('date helpers', () => {
  it('adds days across month boundaries in UTC', () => {
    expect(addDays('2026-08-31', 1)).toBe('2026-09-01');
    expect(addDays('2026-09-01', -1)).toBe('2026-08-31');
  });
  it('counts inclusive days and weekdays', () => {
    expect(daysBetween('2026-09-01', '2026-09-30')).toBe(30);
    expect(weekdayOf(TODAY)).toBe(6);
    expect(eachDay('2026-09-11', TODAY)).toEqual(['2026-09-11', TODAY]);
  });
  it('finds Monday and month end', () => {
    expect(startOfWeekMonday(TODAY)).toBe('2026-09-07');
    expect(startOfWeekMonday('2026-09-13')).toBe('2026-09-07'); // Sunday belongs to the same week
    expect(endOfMonth('2026-02-10')).toBe('2026-02-28');
  });
});

describe('resolveRange', () => {
  it('today compares with the same weekday last week', () => {
    expect(resolveRange('today', TODAY)).toMatchObject({ from: TODAY, to: TODAY, prev_from: '2026-09-05', prev_to: '2026-09-05', days: 1 });
  });
  it('week is Monday–Sunday with the previous week as comparison', () => {
    expect(resolveRange('week', TODAY)).toMatchObject({ from: '2026-09-07', to: '2026-09-13', prev_from: '2026-08-31', prev_to: '2026-09-06', days: 7 });
  });
  it('month is the calendar month with the previous month as comparison', () => {
    expect(resolveRange('month', TODAY)).toMatchObject({ from: '2026-09-01', to: '2026-09-30', prev_from: '2026-08-01', prev_to: '2026-08-31', days: 30 });
  });
  it('custom swaps reversed bounds and shifts back by its own length', () => {
    expect(resolveRange('custom', TODAY, '2026-09-10', '2026-09-01')).toMatchObject({ from: '2026-09-01', to: '2026-09-10', prev_from: '2026-08-22', prev_to: '2026-08-31', days: 10 });
  });
  it('rejects missing, malformed or oversized custom ranges', () => {
    expect(() => resolveRange('custom', TODAY, null, null)).toThrow();
    expect(() => resolveRange('custom', TODAY, '2026-13-01', '2026-09-01')).toThrow();
    expect(() => resolveRange('custom', TODAY, '2026-01-01', '2026-06-01')).toThrow(/max 92/);
  });
});
