/**
 * Pure formatting for the yard TV feed (`/api/public/display` + `DockDisplay`).
 * Kept out of the route so it can be unit-tested and reused by the client.
 */

import { effectivePlate, formatPlateInput, matchesPlateFormat, toPlateFormat } from '@/lib/booking/plate';

/**
 * Plate as shown on the TV: laid out per the vehicle type's `plate_format`
 * ("701234" → "70-1234", "1กข1234" → "1กข 1234"). A plate that does not fit the
 * layout (foreign, military, odd entry by staff) is shown as recorded, because
 * the input mask would silently drop characters it cannot place.
 *
 * @param row Booking with the booked and gate-recorded plates.
 * @param plateFormat `services.plate_format` of the booking's vehicle type (unknown → `any`).
 */
export function displayPlate(row: { plate_number?: string | null; plate_number_actual?: string | null }, plateFormat: unknown): string {
  const raw = effectivePlate(row).trim();
  if (!raw) return '';
  const format = toPlateFormat(plateFormat);
  return matchesPlateFormat(raw, format) ? formatPlateInput(raw, format) : raw;
}

/**
 * "SO-2609-00123" style label for the document a queue belongs to; '' when the
 * queue has no document.
 */
export function docLabel(docType: string | null | undefined, docNo: string | null | undefined): string {
  const no = (docNo ?? '').trim();
  if (!no) return '';
  const prefix = docType === 'so' ? 'SO' : docType === 'po' ? 'PO' : '';
  if (!prefix) return no;
  return no.toUpperCase().startsWith(prefix) ? no : `${prefix} ${no}`;
}

/** `HH:mm` from a Postgres `time` value (`HH:mm:ss`); '' when missing. */
export function hhmm(time: string | null | undefined): string {
  return String(time ?? '').slice(0, 5);
}
