/**
 * Suggested minutes at the dock when approving a queue. A document with item
 * lines suggests lines x minutes-per-item (the quantity on each line is ignored:
 * 1 line x5 pieces and 1 line x10 pieces both count once). Without lines, or
 * with the rule switched off, the vehicle type's duration is the suggestion.
 * Only a starting value: the warehouse may still change it in the dialog.
 */

export const SERVICE_MINUTES_MIN = 5;
export const SERVICE_MINUTES_MAX = 1440;
export const DEFAULT_MINUTES_PER_ITEM = 10;
const FALLBACK_VEHICLE_MINUTES = 30;

export type ItemMinutesRule = { enabled: boolean; minutesPerItem: number };

export type SuggestMinutesInput = {
  itemCount: number | null | undefined;
  minutesPerItem: number | null | undefined;
  enabled: boolean;
  vehicleMinutes: number | null | undefined;
};

export type SuggestedMinutes = { minutes: number; source: 'items' | 'vehicle' };

/** Keep a value inside the range `bookings.service_minutes` accepts. */
function clampMinutes(n: number): number {
  return Math.min(SERVICE_MINUTES_MAX, Math.max(SERVICE_MINUTES_MIN, Math.round(n)));
}

/** Whole, positive number or null. */
function positiveInt(v: number | null | undefined): number | null {
  return typeof v === 'number' && Number.isFinite(v) && v >= 1 ? Math.floor(v) : null;
}

/** Suggested dock minutes and where the number came from. */
export function suggestServiceMinutes({ itemCount, minutesPerItem, enabled, vehicleMinutes }: SuggestMinutesInput): SuggestedMinutes {
  const lines = positiveInt(itemCount);
  if (enabled && lines) {
    const perItem = positiveInt(minutesPerItem) ?? DEFAULT_MINUTES_PER_ITEM;
    return { minutes: clampMinutes(lines * perItem), source: 'items' };
  }
  return { minutes: clampMinutes(positiveInt(vehicleMinutes) ?? FALLBACK_VEHICLE_MINUTES), source: 'vehicle' };
}
