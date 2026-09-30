import { describe, expect, it } from 'vitest';
import { decorateWalkInSlots, isSlotPast, normalizeSlotTime, walkInSlotProblem, type SlotRow } from './slot-time';

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
