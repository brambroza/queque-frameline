import { describe, expect, it } from 'vitest';
import { capToasts, durationFor, MAX_TOASTS } from './toast-timing';

describe('durationFor', () => {
  it('keeps errors longest and success shortest', () => {
    expect(durationFor('error')).toBeGreaterThan(durationFor('warning'));
    expect(durationFor('warning')).toBeGreaterThan(durationFor('success'));
    expect(durationFor('info')).toBe(durationFor('success'));
  });
});

describe('capToasts', () => {
  it('drops the oldest when over the cap', () => {
    const list = [1, 2, 3, 4, 5, 6];
    expect(capToasts(list)).toEqual(list.slice(list.length - MAX_TOASTS));
    expect(capToasts([1, 2])).toEqual([1, 2]);
    expect(capToasts(list, 2)).toEqual([5, 6]);
  });
});
