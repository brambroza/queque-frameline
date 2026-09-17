import { describe, expect, it } from 'vitest';
import { isISODate, isReportPreset, resolveReportRange } from './range-presets';

const today = '2026-09-12'; // Saturday

describe('resolveReportRange', () => {
  it('resolves single-day presets', () => {
    expect(resolveReportRange('today', today)).toMatchObject({ from: today, to: today, days: 1 });
    expect(resolveReportRange('tomorrow', today)).toMatchObject({ from: '2026-09-13', to: '2026-09-13', days: 1 });
  });

  it('looks forward for the upcoming-week preset', () => {
    expect(resolveReportRange('next7', today)).toMatchObject({ from: today, to: '2026-09-18', days: 7 });
  });

  it('resolves calendar week and month', () => {
    expect(resolveReportRange('week', today)).toMatchObject({ from: '2026-09-07', to: '2026-09-13', days: 7 });
    expect(resolveReportRange('month', today)).toMatchObject({ from: '2026-09-01', to: '2026-09-30', days: 30 });
  });

  it('looks back for analysis presets', () => {
    expect(resolveReportRange('last7', today)).toMatchObject({ from: '2026-09-06', to: today, days: 7 });
    expect(resolveReportRange('last30', today)).toMatchObject({ from: '2026-08-14', to: today, days: 30 });
  });

  it('swaps reversed custom bounds', () => {
    expect(resolveReportRange('custom', today, '2026-09-10', '2026-09-01')).toMatchObject({ from: '2026-09-01', to: '2026-09-10', days: 10 });
  });

  it('rejects missing, malformed or oversized custom ranges', () => {
    expect(() => resolveReportRange('custom', today)).toThrow();
    expect(() => resolveReportRange('custom', today, '2026-13-01', today)).toThrow();
    expect(() => resolveReportRange('custom', today, '2026-01-01', '2026-06-30')).toThrow(/max 92/);
  });
});

describe('guards', () => {
  it('validates ISO dates', () => {
    expect(isISODate('2026-02-28')).toBe(true);
    expect(isISODate('2026-2-8')).toBe(false);
    expect(isISODate(null)).toBe(false);
  });

  it('recognises presets', () => {
    expect(isReportPreset('next7')).toBe(true);
    expect(isReportPreset('yesterday')).toBe(false);
  });
});
