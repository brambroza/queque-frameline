import { describe, expect, it } from 'vitest';
import {
  computeReminderWindow,
  isInReminderWindow,
  reminderLeadLabel,
  toBangkokStamp,
  REMINDER_MINUTES_MAX,
  REMINDER_MINUTES_MIN,
} from './booking-reminder';

describe('toBangkokStamp', () => {
  it('renders an instant in Asia/Bangkok (UTC+7)', () => {
    expect(toBangkokStamp(new Date('2026-09-15T03:30:00Z'))).toEqual({ date: '2026-09-15', time: '10:30:00' });
  });

  it('rolls the date forward past Bangkok midnight', () => {
    expect(toBangkokStamp(new Date('2026-09-15T17:05:00Z'))).toEqual({ date: '2026-09-16', time: '00:05:00' });
  });
});

describe('computeReminderWindow', () => {
  it('spans now .. now + lead', () => {
    const w = computeReminderWindow(new Date('2026-09-15T03:00:00Z'), 60);
    expect(w.from).toEqual({ date: '2026-09-15', time: '10:00:00' });
    expect(w.to).toEqual({ date: '2026-09-15', time: '11:00:00' });
  });

  it('crosses midnight when the lead reaches the next day', () => {
    const w = computeReminderWindow(new Date('2026-09-15T16:30:00Z'), 60);
    expect(w.from.date).toBe('2026-09-15');
    expect(w.to).toEqual({ date: '2026-09-16', time: '00:30:00' });
  });

  it('clamps the lead to the allowed range', () => {
    const now = new Date('2026-09-15T03:00:00Z');
    const tooSmall = computeReminderWindow(now, 1);
    expect(tooSmall.to.time).toBe(`10:0${REMINDER_MINUTES_MIN}:00`);
    const tooBig = computeReminderWindow(now, REMINDER_MINUTES_MAX * 10);
    expect(tooBig.to.date).toBe('2026-09-22');
  });
});

describe('isInReminderWindow', () => {
  const w = { from: { date: '2026-09-15', time: '10:00:00' }, to: { date: '2026-09-15', time: '11:00:00' } };

  it('includes the lower bound and excludes the upper bound', () => {
    expect(isInReminderWindow({ date: '2026-09-15', time: '10:00:00' }, w)).toBe(true);
    expect(isInReminderWindow({ date: '2026-09-15', time: '10:59:59' }, w)).toBe(true);
    expect(isInReminderWindow({ date: '2026-09-15', time: '11:00:00' }, w)).toBe(false);
  });

  it('rejects bookings already started or on another day', () => {
    expect(isInReminderWindow({ date: '2026-09-15', time: '09:59:00' }, w)).toBe(false);
    expect(isInReminderWindow({ date: '2026-09-16', time: '10:30:00' }, w)).toBe(false);
  });

  it('accepts HH:MM without seconds', () => {
    expect(isInReminderWindow({ date: '2026-09-15', time: '10:30' }, w)).toBe(true);
  });

  it('matches across a midnight window', () => {
    const night = { from: { date: '2026-09-15', time: '23:30:00' }, to: { date: '2026-09-16', time: '00:30:00' } };
    expect(isInReminderWindow({ date: '2026-09-16', time: '00:10:00' }, night)).toBe(true);
    expect(isInReminderWindow({ date: '2026-09-15', time: '23:00:00' }, night)).toBe(false);
  });
});

describe('reminderLeadLabel', () => {
  it('formats presets in Thai', () => {
    expect(reminderLeadLabel(15)).toBe('15 นาที');
    expect(reminderLeadLabel(60)).toBe('1 ชั่วโมง');
    expect(reminderLeadLabel(90)).toBe('1 ชั่วโมง 30 นาที');
    expect(reminderLeadLabel(1440)).toBe('1 วัน');
  });
});
