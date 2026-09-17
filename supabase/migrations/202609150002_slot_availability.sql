-- Slot availability including full slots.
--
-- get_available_slots only emits slots that still have room, so the LIFF
-- booking grid could not show a full slot as "เต็ม 3/3" — it simply vanished.
-- This function returns every generated slot with its capacity and booked
-- count. get_available_slots is left untouched: the LINE chatbot and the
-- portal create-queue drawer still rely on the "open slots only" contract.

create or replace function public.get_slot_availability(
  p_shop_id uuid,
  p_branch_id uuid,
  p_service_id uuid,
  p_date date,
  p_resource_type text default null,
  p_party_size int default null,
  p_resource_id uuid default null
)
returns table(slot_time time, capacity int, booked_count int, remaining_capacity int)
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
  v_available int;
  v_resource_total int;
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
    and wh.weekday = v_weekday
    and wh.active = true
    and wh.is_deleted = false
    and (wh.branch_id = p_branch_id or wh.branch_id is null)
  order by case when wh.branch_id = p_branch_id then 0 else 1 end
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

  -- Total resources of the requested type; computed once, the per-slot loop
  -- only needs how many of them are free.
  if p_resource_id is null and p_resource_type is not null then
    select count(*) into v_resource_total
    from public.booking_resources r
    where r.shop_id = p_shop_id
      and (p_branch_id is null or r.branch_id = p_branch_id)
      and r.resource_type = coalesce(p_resource_type, 'table')
      and r.active = true
      and r.is_deleted = false
      and r.capacity >= greatest(coalesce(p_party_size, 1), 1);
  end if;

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

      slot_time := v_slot_time;
      capacity := coalesce(v_capacity, 0);
      booked_count := v_booked;
      remaining_capacity := greatest(capacity - v_booked, 0);
      return next;
    else
      v_start_ts := (p_date::text || ' ' || v_slot_time::text || '+07')::timestamptz;
      v_end_ts := v_start_ts + make_interval(mins => coalesce(v_service_duration, v_interval));
      if v_end_ts <= v_start_ts then
        v_end_ts := v_start_ts + interval '1 minute';
      end if;

      if p_resource_id is not null then
        select count(*) into v_booked
        from public.bookings b
        cross join lateral (
          select
            (b.booking_date::text || ' ' || b.start_time::text || '+07')::timestamptz as b_start_ts,
            (b.booking_date::text || ' ' || coalesce(b.end_time, b.start_time + interval '30 minutes')::text || '+07')::timestamptz as b_end_raw_ts
        ) t
        where b.shop_id = p_shop_id
          and b.branch_id = p_branch_id
          and b.resource_id = p_resource_id
          and b.status not in ('cancelled','no_show','skipped','completed')
          and b.is_deleted = false
          and tstzrange(
            t.b_start_ts,
            case when t.b_end_raw_ts > t.b_start_ts then t.b_end_raw_ts else t.b_start_ts + interval '1 minute' end,
            '[)'
          ) && tstzrange(v_start_ts, v_end_ts, '[)');

        slot_time := v_slot_time;
        capacity := 1;
        booked_count := case when v_booked > 0 then 1 else 0 end;
        remaining_capacity := 1 - booked_count;
        return next;
      else
        select count(*) into v_available
        from public.find_available_resources(
          p_shop_id,
          p_branch_id,
          coalesce(p_resource_type, 'table'),
          coalesce(p_party_size, 1),
          v_start_ts,
          v_end_ts
        );

        slot_time := v_slot_time;
        capacity := coalesce(v_resource_total, 0);
        booked_count := greatest(capacity - v_available, 0);
        remaining_capacity := v_available;
        return next;
      end if;
    end if;

    v_current_ts := v_current_ts + make_interval(mins => v_interval);
  end loop;

  return;
end;
$$;
