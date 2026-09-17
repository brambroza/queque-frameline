-- Dock slot engine: availability per vehicle type + direction, free-day
-- calendar, dock picking and atomic booking creation.
--
-- A slot is bookable when at least one eligible dock is free for
-- [start, start + duration + buffer). Eligible = active dock, direction
-- matches (or dock serves both), vehicle type allowed (service_ids null/empty
-- or contains it). Existing bookings block their dock for
-- [start_time, end_time + buffer_minutes).

create unique index if not exists bookings_shop_date_queue_uidx
  on public.bookings (shop_id, booking_date, queue_number)
  where is_deleted = false;

/*
 * Docks a vehicle type may use in one direction.
 */
create or replace function public.eligible_docks(
  p_shop_id uuid,
  p_branch_id uuid,
  p_direction public.booking_direction,
  p_service_id uuid,
  p_resource_id uuid default null
)
returns table(dock_id uuid, dock_code text, dock_name text, is_shared boolean)
language sql
stable
as $$
  select r.id, r.resource_code, r.resource_name, (r.direction is null)
  from public.booking_resources r
  where r.shop_id = p_shop_id
    and r.resource_type = 'dock'
    and r.active = true
    and r.is_deleted = false
    and (r.branch_id is null or p_branch_id is null or r.branch_id = p_branch_id)
    and (r.direction is null or r.direction = p_direction)
    and (r.service_ids is null or cardinality(r.service_ids) = 0 or p_service_id = any(r.service_ids))
    and (p_resource_id is null or r.id = p_resource_id);
$$;

/*
 * True when the dock has no live booking overlapping [p_start, p_end) on p_date.
 * p_end already includes the new booking's buffer; each existing booking is
 * extended by its own stored buffer.
 */
create or replace function public.is_dock_free(
  p_shop_id uuid,
  p_dock_id uuid,
  p_date date,
  p_start time,
  p_end time,
  p_exclude_booking_id uuid default null
)
returns boolean
language sql
stable
as $$
  select not exists (
    select 1
    from public.bookings b
    where b.shop_id = p_shop_id
      and b.resource_id = p_dock_id
      and b.booking_date = p_date
      and b.is_deleted = false
      and b.status not in ('cancelled', 'no_show', 'skipped', 'completed')
      and (p_exclude_booking_id is null or b.id <> p_exclude_booking_id)
      and (p_date + b.start_time) < (p_date + p_end)
      and (p_date + coalesce(b.end_time, b.start_time + interval '30 minutes')
             + make_interval(mins => coalesce(b.buffer_minutes, 0))) > (p_date + p_start)
  );
$$;

/*
 * Every slot of the day for a vehicle type, including full ones.
 * Slots whose service time would run past closing or into the break are not emitted.
 */
create or replace function public.get_dock_slots(
  p_shop_id uuid,
  p_branch_id uuid,
  p_direction public.booking_direction,
  p_service_id uuid,
  p_date date,
  p_resource_id uuid default null,
  p_exclude_booking_id uuid default null
)
returns table(slot_time time, slot_end time, capacity int, booked_count int, remaining_capacity int)
language plpgsql
stable
as $$
declare
  v_open time;
  v_close time;
  v_break_start time;
  v_break_end time;
  v_interval int;
  v_duration int;
  v_buffer int;
  v_capacity int;
  v_free int;
  v_unassigned int;
  v_cur timestamp;
  v_close_ts timestamp;
  v_end_ts timestamp;
  v_block_end_ts timestamp;
begin
  if exists (
    select 1 from public.holidays h
    where h.shop_id = p_shop_id
      and (h.branch_id is null or h.branch_id = p_branch_id)
      and h.holiday_date = p_date
      and h.is_deleted = false
  ) then
    return;
  end if;

  select wh.open_time, wh.close_time, wh.break_start, wh.break_end, wh.slot_interval_minutes
    into v_open, v_close, v_break_start, v_break_end, v_interval
  from public.working_hours wh
  where wh.shop_id = p_shop_id
    and wh.weekday = extract(dow from p_date)::int
    and wh.active = true
    and wh.is_deleted = false
    and (wh.branch_id = p_branch_id or wh.branch_id is null)
    and (wh.direction is null or wh.direction = p_direction)
  order by (wh.direction is not null) desc, (wh.branch_id = p_branch_id) desc
  limit 1;

  if v_open is null then
    return;
  end if;

  select s.duration_minutes, coalesce(s.buffer_minutes, 0)
    into v_duration, v_buffer
  from public.services s
  where s.id = p_service_id
    and s.shop_id = p_shop_id
    and s.active = true
    and s.is_deleted = false
    and (s.direction is null or s.direction = p_direction);

  if v_duration is null then
    return;
  end if;

  select count(*) into v_capacity
  from public.eligible_docks(p_shop_id, p_branch_id, p_direction, p_service_id, p_resource_id);

  v_interval := greatest(coalesce(v_interval, 30), 5);
  v_cur := p_date + v_open;
  v_close_ts := p_date + v_close;

  while v_cur + make_interval(mins => v_duration) <= v_close_ts loop
    v_end_ts := v_cur + make_interval(mins => v_duration);
    v_block_end_ts := v_end_ts + make_interval(mins => v_buffer);

    -- Service time must not run into the break.
    if v_break_start is not null and v_break_end is not null
       and v_cur < (p_date + v_break_end) and v_end_ts > (p_date + v_break_start) then
      v_cur := v_cur + make_interval(mins => v_interval);
      continue;
    end if;

    select count(*) into v_free
    from public.eligible_docks(p_shop_id, p_branch_id, p_direction, p_service_id, p_resource_id) d
    where public.is_dock_free(p_shop_id, d.dock_id, p_date, v_cur::time, v_block_end_ts::time, p_exclude_booking_id);

    -- Live bookings with no dock yet still need one: take them out of the pool.
    select count(*) into v_unassigned
    from public.bookings b
    where b.shop_id = p_shop_id
      and b.booking_date = p_date
      and b.direction = p_direction
      and b.resource_id is null
      and b.is_deleted = false
      and b.status not in ('cancelled', 'no_show', 'skipped', 'completed')
      and (p_exclude_booking_id is null or b.id <> p_exclude_booking_id)
      and (p_date + b.start_time) < v_block_end_ts
      and (p_date + coalesce(b.end_time, b.start_time + interval '30 minutes')
             + make_interval(mins => coalesce(b.buffer_minutes, 0))) > v_cur;

    slot_time := v_cur::time;
    slot_end := v_end_ts::time;
    capacity := v_capacity;
    remaining_capacity := greatest(v_free - v_unassigned, 0);
    booked_count := greatest(v_capacity - remaining_capacity, 0);
    return next;

    v_cur := v_cur + make_interval(mins => v_interval);
  end loop;
end;
$$;

/*
 * Days in [p_from, p_to] (max 62) that still have at least one open slot.
 * p_not_before drops slots starting earlier than that instant (past slots and
 * the site's minimum booking lead time), so "today" only counts what is left.
 */
create or replace function public.get_available_days(
  p_shop_id uuid,
  p_branch_id uuid,
  p_direction public.booking_direction,
  p_service_id uuid,
  p_from date,
  p_to date,
  p_not_before timestamptz default null
)
returns table(day date, open_slots int)
language plpgsql
stable
as $$
declare
  v_day date := p_from;
  v_last date := least(p_to, p_from + 61);
  v_open int;
begin
  while v_day <= v_last loop
    select count(*) into v_open
    from public.get_dock_slots(p_shop_id, p_branch_id, p_direction, p_service_id, v_day) s
    where s.remaining_capacity > 0
      and (p_not_before is null
           or ((v_day::text || ' ' || s.slot_time::text || '+07')::timestamptz >= p_not_before));
    if v_open > 0 then
      day := v_day;
      open_slots := v_open;
      return next;
    end if;
    v_day := v_day + 1;
  end loop;
end;
$$;

/*
 * Create a dock booking atomically: serialises per shop + day, re-checks the
 * slot, picks a dock (direction-specific docks first, shared docks last so they
 * stay available), numbers the queue (R-001 outbound pickup / S-001 inbound
 * delivery, per day) and, when the booking starts confirmed, issues the DO.
 *
 * Raises with a machine-readable message: slot_unavailable | invalid_service | no_working_hours.
 */
create or replace function public.create_dock_booking(
  p_shop_id uuid,
  p_branch_id uuid,
  p_direction public.booking_direction,
  p_service_id uuid,
  p_date date,
  p_start time,
  p_customer_id uuid,
  p_plate_number text,
  p_status public.booking_status,
  p_source text,
  p_resource_id uuid default null,
  p_document_id uuid default null,
  p_driver_name text default null,
  p_driver_phone text default null,
  p_receiver_name text default null,
  p_receiver_phone text default null,
  p_note text default null,
  p_actor uuid default null
)
returns table(booking_id uuid, queue_number text, resource_id uuid, status public.booking_status, do_number text)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_company uuid;
  v_duration int;
  v_buffer int;
  v_end time;
  v_dock uuid;
  v_seq int;
  v_prefix text;
  v_queue text;
  v_do text;
  v_grace int;
  v_format text;
  v_start_ts timestamptz;
  v_id uuid;
begin
  if p_status not in ('pending', 'confirmed') then
    raise exception 'invalid_status';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_shop_id::text || p_date::text));

  select s.company_id into v_company from public.shops s where s.id = p_shop_id and s.is_deleted = false;
  if v_company is null then
    raise exception 'invalid_shop';
  end if;

  select s.duration_minutes, coalesce(s.buffer_minutes, 0) into v_duration, v_buffer
  from public.services s
  where s.id = p_service_id and s.shop_id = p_shop_id and s.active = true and s.is_deleted = false
    and (s.direction is null or s.direction = p_direction);
  if v_duration is null then
    raise exception 'invalid_service';
  end if;

  -- The requested start must be a real, open slot of that day.
  if not exists (
    select 1
    from public.get_dock_slots(p_shop_id, p_branch_id, p_direction, p_service_id, p_date, p_resource_id) s
    where s.slot_time = p_start and s.remaining_capacity > 0
  ) then
    raise exception 'slot_unavailable';
  end if;

  v_end := (p_date + p_start + make_interval(mins => v_duration))::time;

  select d.dock_id into v_dock
  from public.eligible_docks(p_shop_id, p_branch_id, p_direction, p_service_id, p_resource_id) d
  where public.is_dock_free(p_shop_id, d.dock_id, p_date, p_start,
          (p_date + v_end + make_interval(mins => v_buffer))::time)
  order by d.is_shared asc, d.dock_code asc nulls last, d.dock_name asc
  limit 1;
  if v_dock is null then
    raise exception 'slot_unavailable';
  end if;

  v_prefix := case when p_direction = 'outbound' then 'R' else 'S' end;
  select coalesce(max(nullif(regexp_replace(b.queue_number, '\D', '', 'g'), '')::int), 0) + 1 into v_seq
  from public.bookings b
  where b.shop_id = p_shop_id and b.booking_date = p_date and b.queue_number like v_prefix || '-%';
  v_queue := v_prefix || '-' || lpad(v_seq::text, 3, '0');

  select coalesce(ss.grace_minutes, 30), coalesce(ss.do_number_format, 'DO-{YYYYMM}-{NNNN}')
    into v_grace, v_format
  from public.site_settings ss where ss.shop_id = p_shop_id;
  v_grace := coalesce(v_grace, 30);
  v_format := coalesce(v_format, 'DO-{YYYYMM}-{NNNN}');

  v_start_ts := (p_date::text || ' ' || p_start::text || '+07')::timestamptz;

  if p_status = 'confirmed' then
    v_do := public.next_do_number(p_shop_id, v_format);
  end if;

  insert into public.bookings (
    company_id, shop_id, branch_id, service_id, customer_id, booking_date, start_time, end_time,
    queue_number, status, note, resource_id, resource_name, resource_capacity,
    direction, document_id, buffer_minutes, plate_number,
    driver_name, driver_phone, receiver_name, receiver_phone, booking_source,
    confirmed_at, confirmed_by, grace_deadline, do_number, do_issued_at, do_issued_by,
    created_by, updated_by
  )
  select
    v_company, p_shop_id, p_branch_id, p_service_id, p_customer_id, p_date, p_start, v_end,
    v_queue, p_status, p_note, v_dock, r.resource_name, r.capacity,
    p_direction, p_document_id, v_buffer, p_plate_number,
    p_driver_name, p_driver_phone, p_receiver_name, p_receiver_phone, p_source,
    case when p_status = 'confirmed' then now() end,
    case when p_status = 'confirmed' then p_actor end,
    v_start_ts + make_interval(mins => v_grace),
    v_do,
    case when v_do is not null then now() end,
    case when v_do is not null then p_actor end,
    p_actor, p_actor
  from public.booking_resources r where r.id = v_dock
  returning id into v_id;

  if p_document_id is not null then
    update public.external_documents d
       set status = 'booked', updated_by = p_actor
     where d.id = p_document_id and d.shop_id = p_shop_id and d.status = 'open';
  end if;

  booking_id := v_id;
  queue_number := v_queue;
  resource_id := v_dock;
  status := p_status;
  do_number := v_do;
  return next;
end;
$$;

revoke all on function public.create_dock_booking(uuid, uuid, public.booking_direction, uuid, date, time, uuid, text, public.booking_status, text, uuid, uuid, text, text, text, text, text, uuid) from public;
grant execute on function public.create_dock_booking(uuid, uuid, public.booking_direction, uuid, date, time, uuid, text, public.booking_status, text, uuid, uuid, text, text, text, text, text, uuid) to service_role;
grant execute on function public.eligible_docks(uuid, uuid, public.booking_direction, uuid, uuid) to authenticated, service_role;
grant execute on function public.is_dock_free(uuid, uuid, date, time, time, uuid) to authenticated, service_role;
grant execute on function public.get_dock_slots(uuid, uuid, public.booking_direction, uuid, date, uuid, uuid) to authenticated, service_role;
grant execute on function public.get_available_days(uuid, uuid, public.booking_direction, uuid, date, date, timestamptz) to authenticated, service_role;
