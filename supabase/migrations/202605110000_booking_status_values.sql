-- Booking status values used by 202605110001_resources_and_signage.sql.
--
-- Supabase CLI applies each migration inside one transaction, and PostgreSQL
-- refuses to *use* an enum value added in the same transaction ("unsafe use of
-- new value"). Adding the values in their own file first lets the next file
-- create functions that reference them. Same statements, so 202605110001's own
-- `add value if not exists` lines become no-ops.
alter type public.booking_status add value if not exists 'called';
alter type public.booking_status add value if not exists 'seating';
alter type public.booking_status add value if not exists 'in_service';
alter type public.booking_status add value if not exists 'skipped';
alter type public.booking_status add value if not exists 'checked_in';
alter type public.booking_status add value if not exists 'pending_approval';
