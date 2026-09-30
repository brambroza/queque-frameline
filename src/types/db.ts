export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

/**
 * Access levels of a portal role (`roles.access_level`): `admin` runs the site, `manager` runs the
 * warehouse (reports + set-up), `staff` works the gate and docks, `viewer` only looks.
 * Rules live in `src/lib/auth/levels.ts`.
 */
export type AppRole = 'admin' | 'manager' | 'staff' | 'viewer';
/**
 * Statuses the dock queue drives. The DB enum still carries Queue's older values
 * (`waiting`, `seating`, `in_service`, `skipped`, `pending_approval`); new code must not set them.
 */
export type BookingStatus =
  | 'pending'
  | 'confirmed'
  | 'late'
  | 'checked_in'
  | 'called'
  | 'serving'
  | 'completed'
  | 'cancelled'
  | 'no_show';

/** outbound = customer picks goods up (SO) · inbound = supplier delivers (PO). */
export type BookingDirection = 'inbound' | 'outbound';

export type PartnerType = 'customer' | 'supplier';
export type DocumentType = 'so' | 'po';
export type DocumentStatus = 'open' | 'booked' | 'completed' | 'cancelled';
export type DocumentSource = 'api' | 'csv' | 'manual';
export type AutoCallMode = 'off' | 'dock_free' | 'time' | 'hybrid';

export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
}
