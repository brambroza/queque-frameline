-- Customer self check-in from LIFF ("ฉันมาถึงแล้ว").
-- `checked_in` already exists in booking_status (202605110001); this only adds
-- the arrival timestamp so staff can see when the customer turned up.
alter table public.bookings
  add column if not exists checked_in_at timestamptz;

comment on column public.bookings.checked_in_at is 'When the customer declared arrival (LIFF check-in). Null = never checked in.';
