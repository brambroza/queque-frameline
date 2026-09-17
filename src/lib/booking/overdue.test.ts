import { describe, expect, it } from 'vitest';
import { computeOverdueMoves } from './overdue';

const settings = { grace_minutes: 30, auto_no_show_after_grace: true };
const now = new Date('2026-09-21T03:00:00Z');
const row = (o: Partial<{ id: string; status: string; grace_deadline: string | null; called_timeout_at: string | null }>) => ({
  id: 'b1', status: 'confirmed', grace_deadline: null, called_timeout_at: null, ...o,
});

describe('computeOverdueMoves', () => {
  it('leaves bookings inside the grace window alone', () => {
    expect(computeOverdueMoves([row({ grace_deadline: '2026-09-21T03:00:00Z' })], now, settings)).toEqual([]);
    expect(computeOverdueMoves([row({ grace_deadline: '2026-09-21T03:30:00Z' })], now, settings)).toEqual([]);
  });
  it('marks confirmed → late after grace, one hop at a time', () => {
    expect(computeOverdueMoves([row({ grace_deadline: '2026-09-21T02:59:00Z' })], now, settings))
      .toEqual([{ id: 'b1', from: 'confirmed', to: 'late', reason: 'grace_passed' }]);
    expect(computeOverdueMoves([row({ grace_deadline: '2026-09-20T00:00:00Z' })], now, settings)[0].to).toBe('late');
  });
  it('marks late → no_show after a second grace window when enabled', () => {
    const r = row({ status: 'late', grace_deadline: '2026-09-21T02:29:00Z' });
    expect(computeOverdueMoves([r], now, settings)).toEqual([{ id: 'b1', from: 'late', to: 'no_show', reason: 'grace_doubled' }]);
    expect(computeOverdueMoves([r], now, { ...settings, auto_no_show_after_grace: false })).toEqual([]);
    expect(computeOverdueMoves([row({ status: 'late', grace_deadline: '2026-09-21T02:31:00Z' })], now, settings)).toEqual([]);
  });
  it('times out an unanswered call', () => {
    expect(computeOverdueMoves([row({ status: 'called', called_timeout_at: '2026-09-21T02:59:59Z' })], now, settings))
      .toEqual([{ id: 'b1', from: 'called', to: 'no_show', reason: 'call_timeout' }]);
    expect(computeOverdueMoves([row({ status: 'called', called_timeout_at: '2026-09-21T03:10:00Z' })], now, settings)).toEqual([]);
  });
  it('ignores arrived, serving and terminal bookings and bad dates', () => {
    const rows = ['checked_in', 'serving', 'completed', 'cancelled', 'pending'].map((status) => row({ status, grace_deadline: '2026-09-01T00:00:00Z' }));
    expect(computeOverdueMoves(rows, now, settings)).toEqual([]);
    expect(computeOverdueMoves([row({ grace_deadline: 'not-a-date' })], now, settings)).toEqual([]);
  });
});
