-- Optional link between a resource and the services it can serve.
-- NULL or empty array = the resource serves every service (existing behaviour).
-- Stored as an array instead of a join table so no new RLS surface is needed;
-- a shop has at most a few dozen services.

alter table if exists public.booking_resources
  add column if not exists service_ids uuid[];

create index if not exists idx_booking_resources_service_ids
  on public.booking_resources using gin (service_ids);
