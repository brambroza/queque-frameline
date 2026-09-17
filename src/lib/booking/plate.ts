/**
 * Thai licence-plate helpers.
 *
 * Plates reach us typed by customers on phones ("กข 1234", "1กข-1234 กทม",
 * "70-1234 ชลบุรี"). Matching at the gate compares the registration part only:
 * spaces, dashes, dots and a trailing province are ignored. A mismatch never
 * blocks the vehicle — staff decide and may overwrite the plate (audited).
 */

const SEPARATORS = /[\s\-._/]+/g;
/** Trailing province written after the last digit, e.g. "กรุงเทพมหานคร", "ชลบุรี", "กทม". */
const TRAILING_PROVINCE = /(\d)[ก-๙A-Za-z.]+$/u;

export const PLATE_MAX = 20;

/**
 * Canonical form used for storage and comparison: no separators, upper-case
 * latin, province suffix removed. Returns '' for blank input.
 *
 * @param raw Plate as typed.
 */
export function normalizePlate(raw: string | null | undefined): string {
  if (!raw) return '';
  const compact = raw.normalize('NFC').trim().replace(SEPARATORS, '').toUpperCase();
  return compact.replace(TRAILING_PROVINCE, '$1').slice(0, PLATE_MAX);
}

/** A plate needs at least one digit and 2–20 characters once normalised. */
export function isPlausiblePlate(raw: string | null | undefined): boolean {
  const p = normalizePlate(raw);
  return p.length >= 2 && p.length <= PLATE_MAX && /\d/.test(p);
}

/** True when both plates are non-empty and equal after normalisation. */
export function platesMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = normalizePlate(a);
  const nb = normalizePlate(b);
  return na !== '' && na === nb;
}

/**
 * Whether the gate recorded a different plate than the one booked.
 * No actual plate recorded = nothing to flag.
 */
export function hasPlateMismatch(row: { plate_number?: string | null; plate_number_actual?: string | null }): boolean {
  if (!row.plate_number_actual) return false;
  return !platesMatch(row.plate_number, row.plate_number_actual);
}

/** Plate to show staff / signage: the one seen at the gate wins. */
export function effectivePlate(row: { plate_number?: string | null; plate_number_actual?: string | null }): string {
  return row.plate_number_actual || row.plate_number || '';
}
