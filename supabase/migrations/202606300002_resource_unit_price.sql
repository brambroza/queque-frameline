-- Add optional per-resource pricing.
-- Booking/payment code uses booking_resources.unit_price when it is greater than 0,
-- otherwise it falls back to services.price.

alter table public.booking_resources
  add column if not exists unit_price numeric(12,2) not null default 0;

alter table public.booking_resources
  add constraint booking_resources_unit_price_nonnegative
  check (unit_price >= 0)
  not valid;

alter table public.booking_resources
  validate constraint booking_resources_unit_price_nonnegative;
