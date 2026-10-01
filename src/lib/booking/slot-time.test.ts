import { describe, expect, it } from 'vitest';
import { addMinutesToTime, decorateWalkInSlots, isSlotPast, normalizeSlotTime, pickLastQueue, summarizeWalkInSlots, visibleWalkInSlots, walkInSlotProblem, type LiveQueueRow, type SlotRow } from './slot-time';

const now = { date: '2026-09-15', time: '14:40:00' };

describe('normalizeSlotTime', () => {
  it('pads HH:MM to HH:MM:SS', () => {
    expect(normalizeSlotTime('09:00')).toBe('09:00:00');
  });

  it('keeps HH:MM:SS and drops fractional seconds', () => {
    expect(normalizeSlotTime('09:00:00')).toBe('09:00:00');
    expect(normalizeSlotTime('09:00:00.123')).toBe('09:00:00');
  });
});

describe('isSlotPast', () => {
  it('marks slots that started before now on the same day', () => {
    expect(isSlotPast({ date: '2026-09-15', time: '13:30:00' }, now)).toBe(true);
    expect(isSlotPast({ date: '2026-09-15', time: '14:00' }, now)).toBe(true);
    expect(isSlotPast({ date: '2026-09-15', time: '14:30:00' }, now)).toBe(true);
  });

  it('keeps slots starting now or later on the same day', () => {
    expect(isSlotPast({ date: '2026-09-15', time: '14:40:00' }, now)).toBe(false);
    expect(isSlotPast({ date: '2026-09-15', time: '15:00' }, now)).toBe(false);
  });

  it('treats every slot on an earlier date as past', () => {
    expect(isSlotPast({ date: '2026-09-14', time: '23:30:00' }, now)).toBe(true);
  });

  it('treats every slot on a later date as upcoming', () => {
    expect(isSlotPast({ date: '2026-09-16', time: '00:00:00' }, now)).toBe(false);
  });

  it('handles midnight boundaries by date first', () => {
    const justAfterMidnight = { date: '2026-09-16', time: '00:05:00' };
    expect(isSlotPast({ date: '2026-09-15', time: '23:30:00' }, justAfterMidnight)).toBe(true);
    expect(isSlotPast({ date: '2026-09-16', time: '00:00:00' }, justAfterMidnight)).toBe(true);
    expect(isSlotPast({ date: '2026-09-16', time: '00:30:00' }, justAfterMidnight)).toBe(false);
  });
});

describe('decorateWalkInSlots', () => {
  // 2026-09-15 10:12 Bangkok = 03:12Z
  const at = new Date('2026-09-15T03:12:00Z');
  const slot = (start: string, end: string, remaining = 1): SlotRow => ({ slot_time: start, slot_end: end, capacity: 2, booked_count: 2 - remaining, remaining_capacity: remaining });
  const byTime = (rows: SlotRow[], date = '2026-09-15') => Object.fromEntries(decorateWalkInSlots(date, rows, at).map((s) => [s.slot_time.slice(0, 5), s]));

  it('offers the running slot and every later one, never a finished one', () => {
    const s = byTime([slot('09:00:00', '09:30:00'), slot('09:30:00', '10:00:00'), slot('10:00:00', '10:30:00'), slot('10:30:00', '11:00:00')]);
    expect(s['09:30']).toMatchObject({ is_past: true, in_progress: false, bookable: false });
    expect(s['10:00']).toMatchObject({ is_past: false, in_progress: true, bookable: true });
    expect(s['10:30']).toMatchObject({ is_past: false, in_progress: false, bookable: true });
  });

  it('keeps only the latest started slot when long vehicles make slots overlap', () => {
    // 120-minute vehicle on a 30-minute grid: 08:30, 09:00, 09:30 and 10:00 all straddle 10:12.
    const s = byTime([slot('08:30:00', '10:30:00'), slot('09:00:00', '11:00:00'), slot('09:30:00', '11:30:00'), slot('10:00:00', '12:00:00'), slot('10:30:00', '12:30:00')]);
    expect(s['08:30'].bookable).toBe(false);
    expect(s['09:30']).toMatchObject({ is_past: true, in_progress: false, bookable: false });
    expect(s['10:00']).toMatchObject({ in_progress: true, bookable: true });
    expect(s['10:30'].bookable).toBe(true);
  });

  it('refuses a running or upcoming slot with no dock left', () => {
    const s = byTime([slot('10:00:00', '10:30:00', 0), slot('10:30:00', '11:00:00', 0)]);
    expect(s['10:00']).toMatchObject({ in_progress: true, is_past: false, bookable: false });
    expect(s['10:30'].bookable).toBe(false);
  });

  it('treats a slot starting exactly now as upcoming and one ending exactly now as finished', () => {
    const s = byTime([slot('09:42:00', '10:12:00'), slot('10:12:00', '10:42:00')]);
    expect(s['09:42']).toMatchObject({ is_past: true, in_progress: false, bookable: false });
    expect(s['10:12']).toMatchObject({ is_past: false, in_progress: false, bookable: true });
  });

  it('is for today only', () => {
    const rows = [slot('10:00:00', '10:30:00'), slot('15:00:00', '15:30:00')];
    expect(decorateWalkInSlots('2026-09-16', rows, at).every((s) => !s.bookable && !s.in_progress)).toBe(true);
    expect(decorateWalkInSlots('2026-09-14', rows, at).every((s) => !s.bookable && s.is_past)).toBe(true);
  });

  it('never applies a lead time', () => {
    expect(decorateWalkInSlots('2026-09-15', [slot('10:15:00', '10:45:00')], at)[0]).toMatchObject({ too_soon: false, bookable: true });
  });
});

describe('walkInSlotProblem', () => {
  const at = new Date('2026-09-15T03:12:00Z');
  const rows: SlotRow[] = [
    { slot_time: '09:30:00', slot_end: '10:00:00', capacity: 1, booked_count: 0, remaining_capacity: 1 },
    { slot_time: '10:00:00', slot_end: '10:30:00', capacity: 1, booked_count: 0, remaining_capacity: 1 },
    { slot_time: '10:30:00', slot_end: '11:00:00', capacity: 1, booked_count: 1, remaining_capacity: 0 },
  ];
  const slots = decorateWalkInSlots('2026-09-15', rows, at);

  it('accepts the running slot in either time format', () => {
    expect(walkInSlotProblem(slots, '10:00')).toBeNull();
    expect(walkInSlotProblem(slots, '10:00:00')).toBeNull();
  });
  it('names why the others are refused', () => {
    expect(walkInSlotProblem(slots, '09:30')).toBe('slot_past');
    expect(walkInSlotProblem(slots, '10:30')).toBe('slot_unavailable');
    expect(walkInSlotProblem(slots, '10:10')).toBe('slot_unavailable');
  });
});

describe('walk-in overflow', () => {
  // 2026-09-15 16:40 Bangkok = 09:40Z — the last regular slot (16:30) is running.
  const at = new Date('2026-09-15T09:40:00Z');
  const slot = (start: string, end: string, remaining: number, overflow = false): SlotRow => ({ slot_time: start, slot_end: end, capacity: 2, booked_count: 2 - remaining, remaining_capacity: remaining, overflow });
  const day = (rows: SlotRow[]) => decorateWalkInSlots('2026-09-15', rows, at);

  it('carries the overflow flag through and applies the same rules to it', () => {
    const s = day([slot('16:30:00', '17:00:00', 0), slot('17:00:00', '17:30:00', 2, true), slot('17:30:00', '18:00:00', 0, true)]);
    expect(s.map((x) => x.overflow)).toEqual([false, true, true]);
    expect(s[1]).toMatchObject({ bookable: true, is_past: false, in_progress: false });
    expect(s[2].bookable).toBe(false);
  });

  it('summarises a full day as "queue after the last booking"', () => {
    const sum = summarizeWalkInSlots(day([slot('16:00:00', '16:30:00', 1), slot('16:30:00', '17:00:00', 0), slot('17:00:00', '17:30:00', 2, true)]));
    expect(sum.full).toBe(true);
    expect(sum.regular).toEqual([]);
    expect(sum.next?.slot_time).toBe('17:00:00');
  });

  it('prefers a regular slot over any overflow slot', () => {
    const sum = summarizeWalkInSlots(day([slot('16:30:00', '17:00:00', 1), slot('17:00:00', '17:30:00', 2, true)]));
    expect(sum.full).toBe(false);
    expect(sum.next?.slot_time).toBe('16:30:00');
  });

  it('shows overflow slots only when working hours are used up, and only a few', () => {
    const rows = [slot('16:00:00', '16:30:00', 1), slot('16:30:00', '17:00:00', 0), slot('17:00:00', '17:30:00', 2, true), slot('17:30:00', '18:00:00', 2, true), slot('18:00:00', '18:30:00', 2, true), slot('18:30:00', '19:00:00', 2, true)];
    expect(visibleWalkInSlots(day(rows)).map((s) => s.slot_time.slice(0, 5))).toEqual(['16:30', '17:00', '17:30', '18:00']);
    expect(visibleWalkInSlots(day([slot('16:30:00', '17:00:00', 1), slot('17:00:00', '17:30:00', 2, true)])).map((s) => s.slot_time.slice(0, 5))).toEqual(['16:30']);
  });

  it('hides finished regular slots and skips full overflow slots', () => {
    const rows = [slot('16:00:00', '16:30:00', 1), slot('16:30:00', '17:00:00', 0), slot('17:00:00', '17:30:00', 0, true), slot('17:30:00', '18:00:00', 1, true)];
    expect(visibleWalkInSlots(day(rows)).map((s) => s.slot_time.slice(0, 5))).toEqual(['16:30', '17:30']);
  });
});

describe('pickLastQueue', () => {
  const row = (over: Partial<LiveQueueRow>): LiveQueueRow => ({ queue_number: 'R-001', start_time: '10:00:00', end_time: '10:30:00', buffer_minutes: 0, resource_id: 'd1', resource_name: 'ท่า 1', direction: 'outbound', ...over });

  it('returns the booking whose dock is blocked the longest, including turnaround', () => {
    const last = pickLastQueue([row({ queue_number: 'R-001', end_time: '16:30:00' }), row({ queue_number: 'R-002', start_time: '15:30:00', end_time: '16:15:00', buffer_minutes: 30 })], ['d1'], 'outbound');
    expect(last).toMatchObject({ queue_number: 'R-002', end_time: '16:15:00', free_from: '16:45:00', resource_name: 'ท่า 1' });
  });

  it('ignores other docks but counts dock-less bookings of the same direction', () => {
    expect(pickLastQueue([row({ resource_id: 'd9', end_time: '18:00:00' })], ['d1'], 'outbound')).toBeNull();
    expect(pickLastQueue([row({ resource_id: null, resource_name: null, end_time: '12:00:00' }), row({ resource_id: null, direction: 'inbound', end_time: '18:00:00' })], ['d1'], 'outbound')?.end_time).toBe('12:00:00');
  });

  it('falls back to 30 minutes when a booking has no end time', () => {
    expect(pickLastQueue([row({ end_time: null, start_time: '11:00:00' })], ['d1'], 'outbound')?.free_from).toBe('11:30:00');
    expect(addMinutesToTime('23:50', 30)).toBe('23:59:00');
  });
});
