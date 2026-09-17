export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

/** Portal roles. `admin` runs the site (confirm queues, DO, settings); `staff` works the gate and docks. */
export type AppRole = 'admin' | 'staff';
/**
 * Statuses the app actually drives. The DB enum also holds `seating`,
 * `in_service` and `skipped` (migration 202605110001) which nothing sets yet;
 * `src/lib/booking/status-meta.ts` still presents them.
 */
export type BookingStatus =
  | 'pending'
  | 'pending_approval'
  | 'confirmed'
  | 'checked_in'
  | 'waiting'
  | 'called'
  | 'serving'
  | 'completed'
  | 'cancelled'
  | 'no_show';
export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
}
