import { describe, expect, it } from 'vitest';
import { formatDateDMY, formatDateTimeDMY } from './date-format';

describe('formatDateTimeDMY', () => {
  it('shows the Bangkok time, not 00:00 (regression: time parts were never requested)', () => {
    expect(formatDateTimeDMY('2026-10-05T07:45:00Z')).toBe('05/10/2026 14:45');
    expect(formatDateTimeDMY('2026-10-05T14:45:00+07:00')).toBe('05/10/2026 14:45');
  });

  it('rolls the day over at Bangkok midnight and keeps 00 for the hour', () => {
    expect(formatDateTimeDMY('2026-10-05T17:05:00Z')).toBe('06/10/2026 00:05');
    expect(formatDateTimeDMY('2026-10-05T16:59:00Z')).toBe('05/10/2026 23:59');
  });

  it('returns "-" for empty input and echoes input it cannot parse', () => {
    expect(formatDateTimeDMY(null)).toBe('-');
    expect(formatDateTimeDMY(undefined)).toBe('-');
    expect(formatDateTimeDMY('')).toBe('-');
    expect(formatDateTimeDMY('not a date')).toBe('not a date');
  });
});

describe('formatDateDMY', () => {
  it('keeps date-only strings as-is and converts timestamps to the Bangkok date', () => {
    expect(formatDateDMY('2026-10-05')).toBe('05/10/2026');
    expect(formatDateDMY('2026-10-05T17:05:00Z')).toBe('06/10/2026');
    expect(formatDateDMY(null)).toBe('-');
  });
});
