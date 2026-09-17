import { describe, expect, it } from 'vitest';
import { CapacityModel, hourlyCapacityForRow, timeToMinutes, type WorkingHoursRow } from './capacity';

const A = 'aaaaaaaa-0000-0000-0000-000000000001';
const B = 'bbbbbbbb-0000-0000-0000-000000000002';

/** Mon–Sun 09:00–18:00 with a 12:00–13:00 break, 30-min slots, 2 seats per slot. */
function fullWeek(branchId: string | null, capacity = 2): WorkingHoursRow[] {
  return Array.from({ length: 7 }, (_, weekday) => ({
    branch_id: branchId,
    weekday,
    open_time: '09:00:00',
    close_time: '18:00:00',
    break_start: '12:00:00',
    break_end: '13:00:00',
    slot_interval_minutes: 30,
    capacity_per_slot: capacity,
  }));
}

describe('timeToMinutes', () => {
  it('parses HH:MM and HH:MM:SS', () => {
    expect(timeToMinutes('09:30')).toBe(570);
    expect(timeToMinutes('18:00:00')).toBe(1080);
  });
});

describe('hourlyCapacityForRow', () => {
  it('skips the break and multiplies slots by capacity_per_slot', () => {
    const map = hourlyCapacityForRow(fullWeek(A)[0]);
    expect(map.get(9)).toBe(4); // 09:00 + 09:30 × 2 seats
    expect(map.get(12)).toBeUndefined(); // break
    expect(map.get(17)).toBe(4);
    expect(Array.from(map.values()).reduce((s, v) => s + v, 0)).toBe(32); // 16 slots × 2
  });

  it('returns nothing when close <= open', () => {
    expect(hourlyCapacityForRow({ ...fullWeek(A)[0], close_time: '09:00' }).size).toBe(0);
  });
});

describe('CapacityModel', () => {
  it('computes daily capacity for one branch', () => {
    const m = new CapacityModel([A], fullWeek(A), []);
    expect(m.dailyCapacity('2026-09-12')).toBe(32);
    expect(m.hourlyCapacity('2026-09-12', 12)).toBe(0);
  });

  it('sums across two branches with different seat counts', () => {
    const m = new CapacityModel([A, B], [...fullWeek(A, 2), ...fullWeek(B, 1)], []);
    expect(m.dailyCapacity('2026-09-12')).toBe(48);
    expect(m.hourlyCapacity('2026-09-12', 9)).toBe(6);
  });

  it('is zero on a shop-wide holiday and only for that branch on a branch holiday', () => {
    const m = new CapacityModel(
      [A, B],
      [...fullWeek(A), ...fullWeek(B)],
      [
        { branch_id: null, holiday_date: '2026-09-21' },
        { branch_id: A, holiday_date: '2026-09-22' },
      ],
    );
    expect(m.dailyCapacity('2026-09-21')).toBe(0);
    expect(m.isFullHoliday('2026-09-21')).toBe(true);
    expect(m.dailyCapacity('2026-09-22')).toBe(32);
    expect(m.isFullHoliday('2026-09-22')).toBe(false);
  });

  it('falls back to shop-wide rows when a branch has none for that weekday', () => {
    const m = new CapacityModel([A], fullWeek(null, 3), []);
    expect(m.dailyCapacity('2026-09-12')).toBe(48);
  });

  it('prefers the branch row over the shop-wide row', () => {
    const m = new CapacityModel([A], [...fullWeek(null, 3), ...fullWeek(A, 1)], []);
    expect(m.dailyCapacity('2026-09-12')).toBe(16);
  });

  it('is zero when there are no working hours at all', () => {
    const m = new CapacityModel([A], [], []);
    expect(m.dailyCapacity('2026-09-12')).toBe(0);
    expect(m.openHours()).toEqual([]);
  });

  it('ignores inactive rows and lists open hours without the break', () => {
    const rows = fullWeek(A).map((r, i) => (i === 0 ? { ...r, active: false } : r));
    const m = new CapacityModel([A], rows, []);
    expect(m.dailyCapacity('2026-09-13')).toBe(0); // Sunday row inactive
    expect(m.openHours()).toEqual([9, 10, 11, 13, 14, 15, 16, 17]);
  });
});
