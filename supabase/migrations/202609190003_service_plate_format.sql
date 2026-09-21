-- Licence-plate layout per vehicle type. The customer booking link locks the
-- plate input to this layout; staff corrections at the gate stay free-form.
--   car   = Motor Vehicle Act plates  "กข 1234" / "1กข 1234"
--   truck = Land Transport Act plates "70-1234"
--   any   = either of the two

alter table public.services
  add column if not exists plate_format text not null default 'any';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'services_plate_format_check') then
    alter table public.services add constraint services_plate_format_check check (plate_format in ('any', 'car', 'truck'));
  end if;
end $$;

comment on column public.services.plate_format is 'Plate layout the customer link accepts for this vehicle type: any | car (กข 1234) | truck (70-1234).';

-- Seeded heavy vehicle types carry truck plates. Pickups / 4 wheelers stay on
-- "any": commercially registered ones carry truck plates too.
update public.services
   set plate_format = 'truck'
 where id in (
   '40000000-0000-4000-8000-000000000002',
   '40000000-0000-4000-8000-000000000003',
   '40000000-0000-4000-8000-000000000004'
 )
   and plate_format = 'any';
