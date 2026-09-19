/**
 * Geofence for driver self check-in: the driver may press "ฉันมาถึงแล้ว" only
 * when the phone reports a position within the branch's radius. Pure functions
 * so the rule is unit-tested and shared by the API and the page.
 */

export type GeoPoint = { lat: number; lng: number };

export type BranchGeofence = { latitude: number | null; longitude: number | null; checkin_radius_m: number | null };

export type GeofenceResult =
  | { ok: true; enforced: false }
  | { ok: true; enforced: true; distanceM: number; radiusM: number }
  | { ok: false; reason: 'location_required' | 'low_accuracy' | 'too_far'; distanceM?: number; radiusM: number; accuracyM?: number };

export const DEFAULT_CHECKIN_RADIUS_M = 300;

/** A GPS fix vaguer than this cannot prove the driver is at the gate. */
export const MAX_ACCEPTED_ACCURACY_M = 500;

/** Accuracy is credited towards the radius only up to this much, so a vague fix cannot widen the fence. */
export const MAX_ACCURACY_ALLOWANCE_M = 100;

const EARTH_RADIUS_M = 6_371_000;

const toRad = (deg: number) => (deg * Math.PI) / 180;

/** True when the pair is a real coordinate (finite, in range). */
export function isValidPoint(p: { lat: unknown; lng: unknown }): p is GeoPoint {
  return typeof p.lat === 'number' && typeof p.lng === 'number' && Number.isFinite(p.lat) && Number.isFinite(p.lng) && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180;
}

/** Great-circle distance in metres (haversine). */
export function distanceMeters(a: GeoPoint, b: GeoPoint): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** The fence applies only to a branch that has coordinates; without them self check-in stays open. */
export function hasGeofence(branch: BranchGeofence | null | undefined): branch is BranchGeofence & { latitude: number; longitude: number } {
  return Boolean(branch) && isValidPoint({ lat: branch?.latitude, lng: branch?.longitude });
}

/**
 * Decide whether a reported position may check in at this branch.
 *
 * @param branch Branch coordinates and radius (null coordinates = not enforced).
 * @param position Position from the driver's phone, or null when none was sent.
 * @param accuracyM Reported GPS accuracy in metres, if any.
 */
export function checkGeofence(branch: BranchGeofence | null | undefined, position: GeoPoint | null, accuracyM?: number | null): GeofenceResult {
  if (!hasGeofence(branch)) return { ok: true, enforced: false };
  const radiusM = branch.checkin_radius_m && branch.checkin_radius_m > 0 ? branch.checkin_radius_m : DEFAULT_CHECKIN_RADIUS_M;
  if (!position || !isValidPoint(position)) return { ok: false, reason: 'location_required', radiusM };

  const accuracy = typeof accuracyM === 'number' && Number.isFinite(accuracyM) && accuracyM > 0 ? accuracyM : 0;
  if (accuracy > MAX_ACCEPTED_ACCURACY_M) return { ok: false, reason: 'low_accuracy', radiusM, accuracyM: Math.round(accuracy) };

  const distanceM = Math.round(distanceMeters({ lat: branch.latitude, lng: branch.longitude }, position));
  const allowed = radiusM + Math.min(accuracy, MAX_ACCURACY_ALLOWANCE_M);
  if (distanceM > allowed) return { ok: false, reason: 'too_far', distanceM, radiusM, accuracyM: Math.round(accuracy) };
  return { ok: true, enforced: true, distanceM, radiusM };
}

/** Thai message for a refused check-in. */
export function geofenceMessage(r: Extract<GeofenceResult, { ok: false }>): string {
  if (r.reason === 'location_required') return 'ต้องเปิดตำแหน่ง (GPS) เพื่อเช็คอิน กรุณาอนุญาตการเข้าถึงตำแหน่งแล้วลองใหม่';
  if (r.reason === 'low_accuracy') return 'สัญญาณ GPS ยังไม่แม่นพอ กรุณาออกมาที่โล่งแล้วลองใหม่ หรือแจ้งเจ้าหน้าที่หน้าประตู';
  const km = (r.distanceM ?? 0) >= 1000 ? `${((r.distanceM ?? 0) / 1000).toFixed(1)} กม.` : `${r.distanceM} ม.`;
  return `ยังอยู่ห่างจากคลัง ${km} — เช็คอินได้เมื่ออยู่ในระยะ ${r.radiusM} ม.`;
}

/** Parse "13.7563, 100.5018" (Google Maps copy format) into a point. */
export function parseLatLng(text: string): GeoPoint | null {
  const m = text.trim().match(/^\(?\s*(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)\s*\)?$/);
  if (!m) return null;
  const p = { lat: Number(m[1]), lng: Number(m[2]) };
  return isValidPoint(p) ? p : null;
}
