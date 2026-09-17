/**
 * Single source of truth for how a booking status is presented.
 *
 * The DB enum `booking_status` has 13 values (see migrations 202605090001 and
 * 202605110001); `BookingStatus` in `src/types/db.ts` only lists the original seven,
 * so this map is keyed by string and covers every value the API can return.
 */

export type StatusPaletteKey = 'primary' | 'secondary' | 'success' | 'warning' | 'info' | 'error' | 'default';

export type StatusMeta = {
  /** MUI palette key used by chips, donut segments and legends. */
  palette: StatusPaletteKey;
  /** Display order following the booking flow. */
  order: number;
  /** Counts toward occupied capacity (cancelled / no-show / skipped do not). */
  occupies: boolean;
};

export const STATUS_META: Record<string, StatusMeta> = {
  pending: { palette: 'warning', order: 10, occupies: true },
  pending_approval: { palette: 'info', order: 11, occupies: true },
  confirmed: { palette: 'primary', order: 20, occupies: true },
  late: { palette: 'warning', order: 21, occupies: true },
  checked_in: { palette: 'secondary', order: 30, occupies: true },
  waiting: { palette: 'secondary', order: 31, occupies: true },
  called: { palette: 'info', order: 40, occupies: true },
  seating: { palette: 'info', order: 41, occupies: true },
  serving: { palette: 'success', order: 50, occupies: true },
  in_service: { palette: 'success', order: 51, occupies: true },
  completed: { palette: 'success', order: 60, occupies: true },
  skipped: { palette: 'default', order: 70, occupies: false },
  no_show: { palette: 'default', order: 71, occupies: false },
  cancelled: { palette: 'error', order: 80, occupies: false },
};

const FALLBACK_META: StatusMeta = { palette: 'default', order: 99, occupies: true };

/**
 * Presentation metadata for a status; unknown values fall back to a neutral entry.
 */
export function getStatusMeta(status: string): StatusMeta {
  return STATUS_META[status] ?? FALLBACK_META;
}

/**
 * Whether a booking in this status still takes up a slot.
 */
export function statusOccupiesSlot(status: string): boolean {
  return getStatusMeta(status).occupies;
}

/**
 * Sort statuses in booking-flow order (pending → … → cancelled).
 */
export function compareStatus(a: string, b: string): number {
  return getStatusMeta(a).order - getStatusMeta(b).order;
}
