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

/**
 * Plate layout a vehicle type accepts on the customer booking link
 * (`services.plate_format`):
 * - `car`   — Motor Vehicle Act plates: "กข 1234", "1กข 1234" (pickups, vans, cars)
 * - `truck` — Land Transport Act plates: "70-1234" (6 / 10 wheelers, tractors, trailers)
 * - `any`   — either of the two
 *
 * Only the customer link is strict. Staff at the gate keep the loose
 * {@link isPlausiblePlate} check so odd plates (foreign, military) can still be recorded.
 */
export const PLATE_FORMATS = ['any', 'car', 'truck'] as const;
export type PlateFormat = (typeof PLATE_FORMATS)[number];

export const PLATE_FORMAT_INFO: Record<PlateFormat, { label: string; example: string; hint: string }> = {
  any: { label: 'ทั้งสองแบบ', example: 'กข 1234 หรือ 70-1234', hint: 'ป้ายรถยนต์ เช่น กข 1234, 1กข 1234 หรือป้ายรถบรรทุก เช่น 70-1234' },
  car: { label: 'ป้ายรถยนต์ / กระบะ (กข 1234)', example: '1กข 1234', hint: 'ตัวอักษรไทย 1–2 ตัว ตามด้วยเลขไม่เกิน 4 หลัก เช่น กข 1234 หรือ 1กข 1234' },
  truck: { label: 'ป้ายรถบรรทุก (70-1234)', example: '70-1234', hint: 'ตัวเลขล้วน เลขหมวด 2 หลัก ขีด แล้วเลข 4 หลัก เช่น 70-1234' },
};

/** Compared against {@link normalizePlate} output, so no separators appear here. */
const CAR_PLATE = /^[1-9]?[ก-ฮ]{1,2}[0-9]{1,4}$/u;
const TRUCK_PLATE = /^[1-9][0-9]{1,2}[0-9]{4}$/;
const THAI_DIGITS = /[๐-๙]/g;

/** Unknown / missing value (older rows, stale clients) falls back to `any`. */
export function toPlateFormat(value: unknown): PlateFormat {
  return (PLATE_FORMATS as readonly unknown[]).includes(value) ? (value as PlateFormat) : 'any';
}

/** Thai digits typed from a Thai keyboard layout become 0–9. */
function toArabicDigits(raw: string): string {
  return raw.replace(THAI_DIGITS, (d) => String(d.charCodeAt(0) - 0x0e50));
}

/**
 * Strict check used by the customer booking link: the plate must follow the
 * layout of the chosen vehicle type.
 *
 * @param raw Plate as typed (separators and a trailing province are ignored).
 * @param format Layout accepted by the vehicle type.
 */
export function matchesPlateFormat(raw: string | null | undefined, format: PlateFormat): boolean {
  const p = normalizePlate(toArabicDigits(raw ?? ''));
  if (format === 'car') return CAR_PLATE.test(p);
  if (format === 'truck') return TRUCK_PLATE.test(p);
  return CAR_PLATE.test(p) || TRUCK_PLATE.test(p);
}

/** "กข 1234" / "1กข 1234": optional series digit, up to 2 Thai consonants, up to 4 digits. */
function formatCarInput(chars: string): string {
  let lead = '';
  let letters = '';
  let tail = '';
  for (const ch of chars) {
    const digit = ch >= '0' && ch <= '9';
    if (digit && !letters) { if (!lead && ch !== '0') lead = ch; continue; }
    if (digit) { if (tail.length < 4) tail += ch; continue; }
    if (!tail && letters.length < 2) letters += ch;
  }
  return `${lead}${letters}${tail ? ` ${tail}` : ''}`;
}

/** "70-1234" (or "700-1234"): digits only, the last four sit after the dash. */
function formatTruckInput(chars: string): string {
  const digits = chars.replace(/[^0-9]/g, '').replace(/^0+/, '').slice(0, 7);
  if (digits.length <= 2) return digits;
  const prefix = digits.length === 7 ? 3 : 2;
  return `${digits.slice(0, prefix)}-${digits.slice(prefix)}`;
}

/**
 * Input mask for the customer booking form: drops characters the layout cannot
 * contain and inserts the separator, so "701234" becomes "70-1234" and
 * "1กข1234" becomes "1กข 1234" while typing.
 *
 * @param raw Current input value.
 * @param format Layout accepted by the chosen vehicle type.
 */
export function formatPlateInput(raw: string, format: PlateFormat): string {
  const chars = toArabicDigits(raw.normalize('NFC')).replace(/[^0-9ก-ฮ]/gu, '');
  if (format === 'truck') return formatTruckInput(chars);
  if (format === 'car') return formatCarInput(chars);
  // `any`: a Thai consonant means a car plate; two or more leading digits mean a truck plate.
  return /[ก-ฮ]/u.test(chars) || chars.length < 2 ? formatCarInput(chars) : formatTruckInput(chars);
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
