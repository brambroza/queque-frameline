-- Activation fixes: the demo sandbox seeds branches and services but never
-- working_hours, so get_available_slots returns nothing and a demo shop cannot
-- produce a bookable slot. Tag working hours as demo data so the sandbox can
-- create and clean them up like every other seeded table.

alter table if exists public.working_hours
  add column if not exists is_demo boolean not null default false;

create index if not exists idx_working_hours_demo
  on public.working_hours (shop_id, is_demo)
  where is_demo = true;
