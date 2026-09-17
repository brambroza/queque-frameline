export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

/** Portal roles. `admin` runs the site (confirm queues, DO, settings); `staff` works the gate and docks. */
export type AppRole = 'admin' | 'staff';
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
