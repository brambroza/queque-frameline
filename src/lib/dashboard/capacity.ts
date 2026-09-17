import { weekdayOf } from './date-range';

/**
 * Theoretical booking capacity derived from `working_hours` and `holidays`.
 *
 * Capacity for one branch on one weekday = number of slots × `capacity_per_slot`,
 * where slots step through `open_time`–`close_time` by `slot_interval_minutes`,
 * skipping the break. A row with `branch_id = null` is a shop-wide default used by
 * any branch that has no row of its own for that weekday (same fallback as the
 * `get_available_slots` RPC). A holiday zeroes the day for its branch, or for every
 * branch when `branch_id` is null.
 */

export type WorkingHoursRow = {
  branch_id: string | null;
  weekday: number;
  open_time: string;
  close_time: string;
  break_start?: string | null;
  break_end?: string | null;
  slot_interval_minutes: number;
  capacity_per_slot: number;
  active?: boolean | null;
};

export type HolidayRow = {
  branch_id: string | null;
  holiday_date: string;
};

/** Parse `HH:MM[:SS]` into minutes since midnight. */
export function timeToMinutes(value: string): number {
  const [h, m] = value.split(':').map((x) => Number.parseInt(x, 10));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
  return h * 60 + m;
}

/** Per-hour capacity for one working-hours row (hour → seats). */
export function hourlyCapacityForRow(row: WorkingHoursRow): Map<number, number> {
  const out = new Map<number, number>();
  const interval = Math.max(5, row.slot_interval_minutes || 30);
  const perSlot = Math.max(0, row.capacity_per_slot || 0);
  const open = timeToMinutes(row.open_time);
  const close = timeToMinutes(row.close_time);
  const breakStart = row.break_start ? timeToMinutes(row.break_start) : null;
  const breakEnd = row.break_end ? timeToMinutes(row.break_end) : null;
  if (close <= open || perSlot === 0) return out;

  for (let t = open; t + interval <= close; t += interval) {
    const inBreak = breakStart !== null && breakEnd !== null && t < breakEnd && t + interval > breakStart;
    if (inBreak) continue;
    const hour = Math.floor(t / 60);
    out.set(hour, (out.get(hour) ?? 0) + perSlot);
  }
  return out;
}

export class CapacityModel {
  private readonly branchIds: string[];
  private readonly byBranchWeekday = new Map<string, WorkingHoursRow[]>();
  private readonly shopWideByWeekday = new Map<number, WorkingHoursRow[]>();
  private readonly holidayAll = new Set<string>();
  private readonly holidayByBranch = new Map<string, Set<string>>();
  private readonly hourCache = new Map<string, Map<number, number>>();

  /**
   * @param branchIds Branches in scope; capacity is summed across them.
   * @param workingHours Active working-hours rows for the shop (any branch).
   * @param holidays Holiday rows for the shop covering the dates that will be queried.
   */
  constructor(branchIds: string[], workingHours: WorkingHoursRow[], holidays: HolidayRow[]) {
    this.branchIds = Array.from(new Set(branchIds));
    for (const row of workingHours) {
      if (row.active === false) continue;
      if (row.branch_id) {
        const key = `${row.branch_id}:${row.weekday}`;
        this.byBranchWeekday.set(key, [...(this.byBranchWeekday.get(key) ?? []), row]);
      } else {
        this.shopWideByWeekday.set(row.weekday, [...(this.shopWideByWeekday.get(row.weekday) ?? []), row]);
      }
    }
    for (const h of holidays) {
      if (h.branch_id) {
        const set = this.holidayByBranch.get(h.branch_id) ?? new Set<string>();
        set.add(h.holiday_date);
        this.holidayByBranch.set(h.branch_id, set);
      } else {
        this.holidayAll.add(h.holiday_date);
      }
    }
  }

  /** Whether the branch is closed for a holiday on that date. */
  isHoliday(date: string, branchId: string): boolean {
    return this.holidayAll.has(date) || (this.holidayByBranch.get(branchId)?.has(date) ?? false);
  }

  /** Whether every branch in scope is closed for a holiday on that date. */
  isFullHoliday(date: string): boolean {
    if (this.branchIds.length === 0) return this.holidayAll.has(date);
    return this.branchIds.every((b) => this.isHoliday(date, b));
  }

  private rowsFor(branchId: string, weekday: number): WorkingHoursRow[] {
    return this.byBranchWeekday.get(`${branchId}:${weekday}`) ?? this.shopWideByWeekday.get(weekday) ?? [];
  }

  private hoursFor(branchId: string, weekday: number): Map<number, number> {
    const key = `${branchId}:${weekday}`;
    const cached = this.hourCache.get(key);
    if (cached) return cached;
    const merged = new Map<number, number>();
    for (const row of this.rowsFor(branchId, weekday)) {
      for (const [hour, seats] of hourlyCapacityForRow(row)) merged.set(hour, (merged.get(hour) ?? 0) + seats);
    }
    this.hourCache.set(key, merged);
    return merged;
  }

  /** Capacity (seats) across all branches in scope for one hour of one date. */
  hourlyCapacity(date: string, hour: number): number {
    const weekday = weekdayOf(date);
    let total = 0;
    for (const b of this.branchIds) {
      if (this.isHoliday(date, b)) continue;
      total += this.hoursFor(b, weekday).get(hour) ?? 0;
    }
    return total;
  }

  /** Hour → capacity for one date, only hours with capacity > 0. */
  hourlyProfile(date: string): Map<number, number> {
    const weekday = weekdayOf(date);
    const out = new Map<number, number>();
    for (const b of this.branchIds) {
      if (this.isHoliday(date, b)) continue;
      for (const [hour, seats] of this.hoursFor(b, weekday)) out.set(hour, (out.get(hour) ?? 0) + seats);
    }
    return out;
  }

  /** Total seats for one date across all branches in scope. */
  dailyCapacity(date: string): number {
    let total = 0;
    for (const seats of this.hourlyProfile(date).values()) total += seats;
    return total;
  }

  /**
   * Hours the shop is open on at least one weekday (sorted). Used as the shared
   * column axis of the heatmap so every row lines up.
   */
  openHours(): number[] {
    const hours = new Set<number>();
    for (const b of this.branchIds) {
      for (let w = 0; w < 7; w++) for (const h of this.hoursFor(b, w).keys()) hours.add(h);
    }
    return Array.from(hours).sort((a, c) => a - c);
  }
}
