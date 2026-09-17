import { describe, expect, it } from 'vitest';
import { isSlotPast, normalizeSlotTime } from './slot-time';

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
