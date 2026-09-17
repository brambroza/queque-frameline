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
