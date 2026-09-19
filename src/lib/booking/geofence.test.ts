import { describe, expect, it } from 'vitest';
import { checkGeofence, distanceMeters, geofenceMessage, hasGeofence, isValidPoint, parseLatLng } from './geofence';

const WAREHOUSE = { latitude: 13.7563, longitude: 100.5018, checkin_radius_m: 300 };
/** ~111 m per 0.001° of latitude. */
const north = (deg: number) => ({ lat: WAREHOUSE.latitude + deg, lng: WAREHOUSE.longitude });

describe('distanceMeters', () => {
  it('is zero for the same point', () => {
    expect(distanceMeters({ lat: 13.7, lng: 100.5 }, { lat: 13.7, lng: 100.5 })).toBe(0);
  });

  it('matches a known distance (Bangkok → Chiang Mai ≈ 583 km)', () => {
    const d = distanceMeters({ lat: 13.7563, lng: 100.5018 }, { lat: 18.7883, lng: 98.9853 });
    expect(d / 1000).toBeGreaterThan(570);
    expect(d / 1000).toBeLessThan(595);
  });

  it('measures ~111 m for 0.001° of latitude', () => {
    expect(Math.round(distanceMeters({ lat: 13.7563, lng: 100.5018 }, north(0.001)))).toBeGreaterThan(105);
    expect(Math.round(distanceMeters({ lat: 13.7563, lng: 100.5018 }, north(0.001)))).toBeLessThan(117);
  });
});

describe('isValidPoint / hasGeofence', () => {
  it('rejects out-of-range, NaN and non-numbers', () => {
    expect(isValidPoint({ lat: 91, lng: 0 })).toBe(false);
    expect(isValidPoint({ lat: 0, lng: 181 })).toBe(false);
    expect(isValidPoint({ lat: Number.NaN, lng: 0 })).toBe(false);
    expect(isValidPoint({ lat: '13', lng: 100 })).toBe(false);
    expect(isValidPoint({ lat: 13.7, lng: 100.5 })).toBe(true);
  });

  it('needs both coordinates', () => {
    expect(hasGeofence(null)).toBe(false);
    expect(hasGeofence({ latitude: 13.7, longitude: null, checkin_radius_m: 300 })).toBe(false);
    expect(hasGeofence(WAREHOUSE)).toBe(true);
  });
});

describe('checkGeofence', () => {
  it('is not enforced for a branch without coordinates', () => {
    expect(checkGeofence({ latitude: null, longitude: null, checkin_radius_m: 300 }, null)).toEqual({ ok: true, enforced: false });
  });

  it('requires a position once the branch has coordinates', () => {
    const r = checkGeofence(WAREHOUSE, null);
    expect(r).toMatchObject({ ok: false, reason: 'location_required', radiusM: 300 });
  });

  it('rejects an invalid position as missing', () => {
    expect(checkGeofence(WAREHOUSE, { lat: 999, lng: 0 })).toMatchObject({ ok: false, reason: 'location_required' });
  });

  it('accepts a position inside the radius', () => {
    const r = checkGeofence(WAREHOUSE, north(0.002), 10);
    expect(r.ok).toBe(true);
    if (r.ok && r.enforced) expect(r.distanceM).toBeLessThan(300);
  });

  it('rejects a position outside the radius with the distance', () => {
    const r = checkGeofence(WAREHOUSE, north(0.01), 10);
    expect(r).toMatchObject({ ok: false, reason: 'too_far', radiusM: 300 });
    if (!r.ok) expect(r.distanceM).toBeGreaterThan(1000);
  });

  it('credits accuracy towards the radius, capped at 100 m', () => {
    // ~355 m away: outside 300 m, inside 300 + 100.
    expect(checkGeofence(WAREHOUSE, north(0.0032), 5).ok).toBe(false);
    expect(checkGeofence(WAREHOUSE, north(0.0032), 80).ok).toBe(true);
    // ~555 m away: a 400 m accuracy must not stretch the fence past +100 m.
    expect(checkGeofence(WAREHOUSE, north(0.005), 400)).toMatchObject({ ok: false, reason: 'too_far' });
  });

  it('rejects a fix too vague to prove anything', () => {
    expect(checkGeofence(WAREHOUSE, north(0), 2000)).toMatchObject({ ok: false, reason: 'low_accuracy' });
  });

  it('falls back to 300 m when the radius is missing or zero', () => {
    const r = checkGeofence({ ...WAREHOUSE, checkin_radius_m: null }, north(0.002), 0);
    expect(r).toMatchObject({ ok: true, enforced: true, radiusM: 300 });
    expect(checkGeofence({ ...WAREHOUSE, checkin_radius_m: 0 }, north(0.002))).toMatchObject({ radiusM: 300 });
  });

  it('ignores a negative or non-finite accuracy', () => {
    expect(checkGeofence(WAREHOUSE, north(0.002), -5).ok).toBe(true);
    expect(checkGeofence(WAREHOUSE, north(0.002), Number.NaN).ok).toBe(true);
  });
});

describe('geofenceMessage', () => {
  it('states distance in metres or km and the allowed radius', () => {
    expect(geofenceMessage({ ok: false, reason: 'too_far', distanceM: 850, radiusM: 300 })).toContain('850 ม.');
    expect(geofenceMessage({ ok: false, reason: 'too_far', distanceM: 12_400, radiusM: 300 })).toContain('12.4 กม.');
    expect(geofenceMessage({ ok: false, reason: 'too_far', distanceM: 850, radiusM: 300 })).toContain('300 ม.');
  });

  it('explains the other refusals', () => {
    expect(geofenceMessage({ ok: false, reason: 'location_required', radiusM: 300 })).toContain('GPS');
    expect(geofenceMessage({ ok: false, reason: 'low_accuracy', radiusM: 300 })).toContain('ไม่แม่น');
  });
});

describe('parseLatLng', () => {
  it('parses the Google Maps copy format', () => {
    expect(parseLatLng('13.756331, 100.501762')).toEqual({ lat: 13.756331, lng: 100.501762 });
    expect(parseLatLng('(13.7563,100.5018)')).toEqual({ lat: 13.7563, lng: 100.5018 });
    expect(parseLatLng('  -33.86 151.21 ')).toEqual({ lat: -33.86, lng: 151.21 });
  });

  it('returns null for junk or out-of-range values', () => {
    expect(parseLatLng('')).toBeNull();
    expect(parseLatLng('bangkok')).toBeNull();
    expect(parseLatLng('13.7')).toBeNull();
    expect(parseLatLng('113.7, 100.5')).toBeNull();
  });
});
