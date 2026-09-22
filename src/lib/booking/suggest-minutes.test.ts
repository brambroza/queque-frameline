import { describe, expect, it } from 'vitest';
import { suggestServiceMinutes } from './suggest-minutes';

const base = { minutesPerItem: 10, enabled: true, vehicleMinutes: 45 };

describe('suggestServiceMinutes', () => {
  it('counts lines, not quantity: 2 lines = 20 minutes', () => {
    expect(suggestServiceMinutes({ ...base, itemCount: 2 })).toEqual({ minutes: 20, source: 'items' });
  });

  it('falls back to the vehicle time when the document has no lines', () => {
    expect(suggestServiceMinutes({ ...base, itemCount: 0 })).toEqual({ minutes: 45, source: 'vehicle' });
    expect(suggestServiceMinutes({ ...base, itemCount: null })).toEqual({ minutes: 45, source: 'vehicle' });
    expect(suggestServiceMinutes({ ...base, itemCount: undefined })).toEqual({ minutes: 45, source: 'vehicle' });
  });

  it('ignores a negative or non-finite line count', () => {
    expect(suggestServiceMinutes({ ...base, itemCount: -3 }).source).toBe('vehicle');
    expect(suggestServiceMinutes({ ...base, itemCount: Number.NaN }).source).toBe('vehicle');
  });

  it('uses the vehicle time when the rule is switched off', () => {
    expect(suggestServiceMinutes({ ...base, itemCount: 5, enabled: false })).toEqual({ minutes: 45, source: 'vehicle' });
  });

  it('honours a custom minutes-per-item setting', () => {
    expect(suggestServiceMinutes({ ...base, itemCount: 2, minutesPerItem: 15 })).toEqual({ minutes: 30, source: 'items' });
  });

  it('defaults to 10 minutes per line when the setting is missing or invalid', () => {
    expect(suggestServiceMinutes({ ...base, itemCount: 3, minutesPerItem: null }).minutes).toBe(30);
    expect(suggestServiceMinutes({ ...base, itemCount: 3, minutesPerItem: 0 }).minutes).toBe(30);
  });

  it('clamps to the 5–1440 range of bookings.service_minutes', () => {
    expect(suggestServiceMinutes({ ...base, itemCount: 1, minutesPerItem: 1 })).toEqual({ minutes: 5, source: 'items' });
    expect(suggestServiceMinutes({ ...base, itemCount: 500, minutesPerItem: 10 })).toEqual({ minutes: 1440, source: 'items' });
  });

  it('uses 30 minutes when neither lines nor a vehicle time exist', () => {
    expect(suggestServiceMinutes({ ...base, itemCount: 0, vehicleMinutes: null })).toEqual({ minutes: 30, source: 'vehicle' });
  });
});
