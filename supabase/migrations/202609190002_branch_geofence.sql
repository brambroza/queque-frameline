-- Driver self check-in geofence: each branch (warehouse) carries its own
-- coordinates and radius. A branch without coordinates is not fenced.

alter table public.branches
  add column if not exists latitude double precision,
  add column if not exists longitude double precision,
  add column if not exists checkin_radius_m integer not null default 300;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'branches_latitude_range') then
    alter table public.branches add constraint branches_latitude_range check (latitude is null or (latitude between -90 and 90));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'branches_longitude_range') then
    alter table public.branches add constraint branches_longitude_range check (longitude is null or (longitude between -180 and 180));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'branches_checkin_radius_range') then
    alter table public.branches add constraint branches_checkin_radius_range check (checkin_radius_m between 50 and 5000);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'branches_coordinates_paired') then
    alter table public.branches add constraint branches_coordinates_paired check ((latitude is null) = (longitude is null));
  end if;
end $$;

comment on column public.branches.latitude is 'Warehouse gate latitude; with longitude it turns on the driver check-in geofence.';
comment on column public.branches.checkin_radius_m is 'Driver may self check-in within this many metres of the branch.';

-- Drivers check in by themselves from their link (decided 2026-09-19).
update public.site_settings set driver_self_checkin = true where driver_self_checkin is distinct from true;
alter table public.site_settings alter column driver_self_checkin set default true;
