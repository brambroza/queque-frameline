import { describe, expect, it } from 'vitest';
import { averageClosedMinutes, closedMinutes, formatMinutes, queueDuration } from './queue-duration';

const called = '2026-09-29T02:00:00.000Z';
const now = Date.parse('2026-09-29T02:20:00.000Z');

describe('queueDuration', () => {
  it('measures a closed queue from call to close', () => {
    expect(queueDuration({ status: 'completed', called_at: called, completed_at: '2026-09-29T02:47:20.000Z' }, now)).toEqual({ kind: 'done', minutes: 47 });
  });

  it('counts minutes so far while called or serving', () => {
    expect(queueDuration({ status: 'called', called_at: called, completed_at: null }, now)).toEqual({ kind: 'running', minutes: 20 });
    expect(queueDuration({ status: 'serving', called_at: called, completed_at: null }, now)).toEqual({ kind: 'running', minutes: 20 });
  });

  it('has nothing to show before the call', () => {
    expect(queueDuration({ status: 'checked_in', called_at: null, completed_at: null }, now)).toEqual({ kind: 'none' });
    expect(queueDuration({ status: 'confirmed', called_at: undefined, completed_at: undefined }, now)).toEqual({ kind: 'none' });
  });

  it('ignores queues that ended without a job', () => {
    expect(queueDuration({ status: 'no_show', called_at: called, completed_at: null }, now)).toEqual({ kind: 'none' });
    expect(queueDuration({ status: 'cancelled', called_at: called, completed_at: null }, now)).toEqual({ kind: 'none' });
  });

  it('refuses timestamps in the wrong order or unreadable', () => {
    expect(queueDuration({ status: 'completed', called_at: called, completed_at: '2026-09-29T01:00:00.000Z' }, now)).toEqual({ kind: 'none' });
    expect(queueDuration({ status: 'completed', called_at: 'x', completed_at: called }, now)).toEqual({ kind: 'none' });
    expect(queueDuration({ status: 'completed', called_at: called, completed_at: null }, now)).toEqual({ kind: 'none' });
    expect(queueDuration({ status: 'serving', called_at: called, completed_at: null }, Date.parse(called) - 1000)).toEqual({ kind: 'none' });
  });

  it('reports zero for a queue closed within the same minute', () => {
    expect(queueDuration({ status: 'completed', called_at: called, completed_at: '2026-09-29T02:00:20.000Z' }, now)).toEqual({ kind: 'done', minutes: 0 });
  });
});

describe('closedMinutes / averageClosedMinutes', () => {
  const rows = [
    { status: 'completed', called_at: called, completed_at: '2026-09-29T02:30:00.000Z' },
    { status: 'completed', called_at: called, completed_at: '2026-09-29T02:45:00.000Z' },
    { status: 'serving', called_at: called, completed_at: null },
    { status: 'cancelled', called_at: null, completed_at: null },
  ];

  it('returns minutes only for closed queues', () => {
    expect(rows.map(closedMinutes)).toEqual([30, 45, null, null]);
  });

  it('averages closed queues and ignores the rest', () => {
    expect(averageClosedMinutes(rows)).toBe(38);
    expect(averageClosedMinutes([rows[2], rows[3]])).toBeNull();
    expect(averageClosedMinutes([])).toBeNull();
  });
});

describe('formatMinutes', () => {
  const unit = { minute: 'นาที', hour: 'ชม.' };
  it('switches to hours from 60 minutes', () => {
    expect(formatMinutes(0, unit)).toBe('0 นาที');
    expect(formatMinutes(59, unit)).toBe('59 นาที');
    expect(formatMinutes(60, unit)).toBe('1 ชม.');
    expect(formatMinutes(125, unit)).toBe('2 ชม. 5 นาที');
  });
});
