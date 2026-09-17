-- Phase 1: Resources, signage, and booking extensions (safe additive migration)

create extension if not exists btree_gist;

-- 1) Booking resources
create table if not exists public.booking_resources (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  shop_id uuid not null references public.shops(id),
  branch_id uuid references public.branches(id),
  resource_type text not null,
  resource_code text,
  resource_name text not null,
  capacity int not null default 1,
  floor text,
  zone text,
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  is_deleted boolean not null default false
);

create index if not exists idx_booking_resources_company on public.booking_resources(company_id);
create index if not exists idx_booking_resources_shop on public.booking_resources(shop_id);
create index if not exists idx_booking_resources_branch on public.booking_resources(branch_id);
create index if not exists idx_booking_resources_type on public.booking_resources(resource_type);
create index if not exists idx_booking_resources_capacity on public.booking_resources(capacity);
create index if not exists idx_booking_resources_active on public.booking_resources(active);
create unique index if not exists idx_booking_resources_unique_code
  on public.booking_resources(shop_id, branch_id, resource_code)
  where is_deleted = false and resource_code is not null;

-- 2) Booking resource assignments
create table if not exists public.booking_resource_assignments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  shop_id uuid not null references public.shops(id),
  branch_id uuid references public.branches(id),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  resource_id uuid not null references public.booking_resources(id),
  assigned_at timestamptz not null default now(),
  assigned_by uuid,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists idx_booking_resource_assignments_booking on public.booking_resource_assignments(booking_id);
create index if not exists idx_booking_resource_assignments_resource on public.booking_resource_assignments(resource_id);
create index if not exists idx_booking_resource_assignments_shop on public.booking_resource_assignments(shop_id);
create index if not exists idx_booking_resource_assignments_branch on public.booking_resource_assignments(branch_id);

-- 3) Extend bookings
alter table public.bookings
  add column if not exists party_size int,
  add column if not exists resource_id uuid references public.booking_resources(id),
  add column if not exists resource_name text,
  add column if not exists resource_capacity int,
  add column if not exists called_at timestamptz,
  add column if not exists called_by uuid,
  add column if not exists call_count int not null default 0,
  add column if not exists last_line_notify_at timestamptz,
  add column if not exists estimated_wait_minutes int,
  add column if not exists priority int not null default 0,
  add column if not exists signage_display boolean not null default true,
  add column if not exists display_order int;

create index if not exists idx_bookings_resource_id on public.bookings(resource_id);
create index if not exists idx_bookings_party_size on public.bookings(party_size);
create index if not exists idx_bookings_signage_display on public.bookings(signage_display);

-- 4) Booking status expansion
alter type public.booking_status add value if not exists 'called';
alter type public.booking_status add value if not exists 'seating';
alter type public.booking_status add value if not exists 'in_service';
alter type public.booking_status add value if not exists 'skipped';
alter type public.booking_status add value if not exists 'checked_in';
alter type public.booking_status add value if not exists 'pending_approval';

-- 5) Signage settings
create table if not exists public.signage_settings (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  shop_id uuid not null references public.shops(id),
  branch_id uuid references public.branches(id),
  enabled boolean not null default true,
  theme text not null default 'dark',
  customer_name_mode text not null default 'masked' check (customer_name_mode in ('hidden', 'masked', 'full')),
  show_logo boolean not null default true,
  show_service_name boolean not null default true,
  show_resource_name boolean not null default true,
  next_queue_limit int not null default 5,
  waiting_queue_limit int not null default 10,
  refresh_seconds int not null default 10,
  announcement_text text,
  near_queue_notify_enabled boolean not null default true,
  near_queue_position int not null default 3,
  near_queue_minutes int not null default 10,
  notify_on_called boolean not null default true,
  notify_on_skipped boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  is_deleted boolean not null default false
);

create unique index if not exists idx_signage_settings_unique_scope
  on public.signage_settings(shop_id, branch_id)
  where is_deleted = false;
create index if not exists idx_signage_settings_shop on public.signage_settings(shop_id);
create index if not exists idx_signage_settings_branch on public.signage_settings(branch_id);

-- 6) Extend service templates for richer defaults
alter table public.service_templates
  add column if not exists default_duration_minutes int,
  add column if not exists default_capacity_per_slot int;

-- 7) Trigger updated_at for new mutable tables
drop trigger if exists trg_booking_resources_updated_at on public.booking_resources;
create trigger trg_booking_resources_updated_at
before update on public.booking_resources
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_signage_settings_updated_at on public.signage_settings;
create trigger trg_signage_settings_updated_at
before update on public.signage_settings
for each row execute procedure public.set_updated_at();

-- 8) Resource finder
create or replace function public.find_available_resources(
  p_shop_id uuid,
  p_branch_id uuid,
  p_resource_type text,
  p_party_size int,
  p_start_time timestamptz,
  p_end_time timestamptz
)
returns table(
  resource_id uuid,
  resource_code text,
  resource_name text,
  capacity int
)
language sql
stable
as $$
  with candidates as (
    select r.id, r.resource_code, r.resource_name, r.capacity
    from public.booking_resources r
    where r.shop_id = p_shop_id
      and (p_branch_id is null or r.branch_id = p_branch_id)
      and r.resource_type = p_resource_type
      and r.active = true
      and r.is_deleted = false
      and r.capacity >= greatest(coalesce(p_party_size, 1), 1)
  ),
  occupied as (
    select b.resource_id
    from public.bookings b
    where b.shop_id = p_shop_id
      and (p_branch_id is null or b.branch_id = p_branch_id)
      and b.resource_id is not null
      and b.is_deleted = false
      and b.status not in ('cancelled','no_show','skipped','completed')
      and tstzrange(
        (b.booking_date::text || ' ' || b.start_time::text || '+07')::timestamptz,
        (b.booking_date::text || ' ' || coalesce(b.end_time, b.start_time + interval '30 minutes')::text || '+07')::timestamptz,
        '[)'
      ) && tstzrange(p_start_time, p_end_time, '[)')
  )
  select c.id, c.resource_code, c.resource_name, c.capacity
  from candidates c
  left join occupied o on o.resource_id = c.id
  where o.resource_id is null
  order by c.capacity asc, c.resource_code asc nulls last, c.resource_name asc;
$$;

-- 9) Upgrade available slots with optional resource filtering
create or replace function public.get_available_slots(
  p_shop_id uuid,
  p_branch_id uuid,
  p_service_id uuid,
  p_date date,
  p_resource_type text default null,
  p_party_size int default null,
  p_resource_id uuid default null
)
returns table(slot_time time, remaining_capacity int)
language plpgsql
as $$
declare
  v_weekday int;
  v_open time;
  v_close time;
  v_break_start time;
  v_break_end time;
  v_interval int;
  v_capacity int;
  v_service_duration int;
  v_current_ts timestamp;
  v_close_ts timestamp;
  v_slot_time time;
  v_booked int;
  v_resource_count int;
  v_start_ts timestamptz;
  v_end_ts timestamptz;
begin
  if exists(
    select 1 from public.holidays h
    where h.shop_id = p_shop_id
      and (h.branch_id is null or h.branch_id = p_branch_id)
      and h.holiday_date = p_date
      and h.is_deleted = false
  ) then
    return;
  end if;

  v_weekday := extract(dow from p_date);

  select wh.open_time, wh.close_time, wh.break_start, wh.break_end, wh.slot_interval_minutes, wh.capacity_per_slot
  into v_open, v_close, v_break_start, v_break_end, v_interval, v_capacity
  from public.working_hours wh
  where wh.shop_id = p_shop_id
    and wh.branch_id = p_branch_id
    and wh.weekday = v_weekday
    and wh.active = true
    and wh.is_deleted = false
  limit 1;

  if v_open is null then
    return;
  end if;

  select coalesce(s.duration_minutes, v_interval), coalesce(s.capacity_per_slot, v_capacity)
  into v_service_duration, v_capacity
  from public.services s
  where s.id = p_service_id
    and s.shop_id = p_shop_id
    and s.active = true
    and s.is_deleted = false
  limit 1;

  v_current_ts := p_date::timestamp + v_open;
  v_close_ts := p_date::timestamp + v_close;

  while v_current_ts + make_interval(mins => coalesce(v_service_duration, v_interval)) <= v_close_ts loop
    v_slot_time := v_current_ts::time;

    if v_break_start is not null and v_break_end is not null and v_slot_time >= v_break_start and v_slot_time < v_break_end then
      v_current_ts := v_current_ts + make_interval(mins => v_interval);
      continue;
    end if;

    if p_resource_type is null and p_resource_id is null then
      select count(*) into v_booked
      from public.bookings b
      where b.shop_id = p_shop_id
        and b.branch_id = p_branch_id
        and b.service_id = p_service_id
        and b.booking_date = p_date
        and b.start_time = v_slot_time
        and b.status not in ('cancelled','no_show')
        and b.is_deleted = false;

      if v_booked < v_capacity then
        slot_time := v_slot_time;
        remaining_capacity := v_capacity - v_booked;
        return next;
      end if;
    else
      v_start_ts := (p_date::text || ' ' || v_slot_time::text || '+07')::timestamptz;
      v_end_ts := v_start_ts + make_interval(mins => coalesce(v_service_duration, v_interval));

      if p_resource_id is not null then
        select count(*) into v_booked
        from public.bookings b
        where b.shop_id = p_shop_id
          and b.branch_id = p_branch_id
          and b.resource_id = p_resource_id
          and b.status not in ('cancelled','no_show','skipped','completed')
          and b.is_deleted = false
          and tstzrange(
            (b.booking_date::text || ' ' || b.start_time::text || '+07')::timestamptz,
            (b.booking_date::text || ' ' || coalesce(b.end_time, b.start_time + interval '30 minutes')::text || '+07')::timestamptz,
            '[)'
          ) && tstzrange(v_start_ts, v_end_ts, '[)');

        if v_booked = 0 then
          slot_time := v_slot_time;
          remaining_capacity := 1;
          return next;
        end if;
      else
        select count(*) into v_resource_count
        from public.find_available_resources(
          p_shop_id,
          p_branch_id,
          coalesce(p_resource_type, 'table'),
          coalesce(p_party_size, 1),
          v_start_ts,
          v_end_ts
        );

        if v_resource_count > 0 then
          slot_time := v_slot_time;
          remaining_capacity := v_resource_count;
          return next;
        end if;
      end if;
    end if;

    v_current_ts := v_current_ts + make_interval(mins => v_interval);
  end loop;

  return;
end;
$$;

-- 10) RLS for new tables
alter table public.booking_resources enable row level security;
alter table public.booking_resource_assignments enable row level security;
alter table public.signage_settings enable row level security;

drop policy if exists p_booking_resources_rw on public.booking_resources;
create policy p_booking_resources_rw
on public.booking_resources
for all
using (public.can_access_shop(shop_id))
with check (public.can_access_shop(shop_id));

drop policy if exists p_booking_resource_assignments_rw on public.booking_resource_assignments;
create policy p_booking_resource_assignments_rw
on public.booking_resource_assignments
for all
using (public.can_access_shop(shop_id))
with check (public.can_access_shop(shop_id));

drop policy if exists p_signage_settings_rw on public.signage_settings;
create policy p_signage_settings_rw
on public.signage_settings
for all
using (public.can_access_shop(shop_id))
with check (public.can_access_shop(shop_id));

