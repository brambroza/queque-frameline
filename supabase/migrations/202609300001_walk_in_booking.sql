/*
 * Walk-in queues: a truck that arrived without a booking gets one on the spot
 * from the portal (sales admin, purchasing or warehouse staff).
 *
 * The only schema change is the new `booking_source` value. `create_dock_booking`
 * already accepts a slot that has started, so the walk-in rules (today only,
 * the running slot, auto check-in) live in the API.
 */
alter table public.bookings drop constraint if exists bookings_booking_source_check;
alter table public.bookings
  add constraint bookings_booking_source_check check (booking_source in ('customer_link', 'admin', 'api', 'walk_in'));
