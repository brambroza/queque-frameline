-- ============================================================
-- move_dock_booking gains p_service_minutes: the scheduling dialog moves a
-- queue (date / time / dock) and sets its dock time in one transaction, so
-- a refused move never leaves the minutes half-changed. Omitted = keep the
-- queue's current service_minutes (same behaviour as before).
-- ============================================================

drop function if exists public.move_dock_booking(uuid, uuid, date, time, uuid, uuid);

create or replace function public.move_dock_booking(
  p_shop_id uuid,
  p_booking_id uuid,
  p_date date,
  p_start time,
  p_resource_id uuid default null,
  p_actor uuid default null,
  p_service_minutes int default null
)
returns table(booking_id uuid, resource_id uuid, end_time time, queue_number text)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_b public.bookings%rowtype;
  v_duration int;
  v_end time;
  v_end_ts timestamp;
  v_dock uuid;
  v_grace int;
  v_queue text;
  v_prefix text;
  v_seq int;
begin
  if p_service_minutes is not null and (p_service_minutes < 5 or p_service_minutes > 1440) then
    raise exception 'invalid_minutes';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_shop_id::text || p_date::text));

  select * into v_b from public.bookings b
   where b.id = p_booking_id and b.shop_id = p_shop_id and b.is_deleted = false
   for update;
  if not found or v_b.status not in ('pending', 'confirmed', 'late') then
    raise exception 'not_movable';
  end if;

  select s.duration_minutes into v_duration from public.services s where s.id = v_b.service_id;
  v_duration := coalesce(p_service_minutes, v_b.service_minutes, v_duration, 30);
  v_end_ts := p_date + p_start + make_interval(mins => v_duration);
  if v_end_ts::date <> p_date then
    raise exception 'slot_unavailable';
  end if;
  v_end := v_end_ts::time;

  if not exists (
    select 1
    from public.get_dock_slots(p_shop_id, v_b.branch_id, v_b.direction, v_b.service_id, p_date, p_resource_id, p_booking_id) s
    where s.slot_time = p_start and s.remaining_capacity > 0
  ) then
    raise exception 'slot_unavailable';
  end if;

  select d.dock_id into v_dock
  from public.eligible_docks(p_shop_id, v_b.branch_id, v_b.direction, v_b.service_id, p_resource_id) d
  where public.is_dock_free(p_shop_id, d.dock_id, p_date, p_start,
          least(v_end_ts + make_interval(mins => coalesce(v_b.buffer_minutes, 0)), p_date + time '23:59:59')::time, p_booking_id)
  -- stay on the current dock when it is still free
  order by (d.dock_id = v_b.resource_id) desc, d.is_shared asc, d.dock_code asc nulls last
  limit 1;
  if v_dock is null then
    raise exception 'slot_unavailable';
  end if;

  select coalesce(ss.grace_minutes, 30) into v_grace from public.site_settings ss where ss.shop_id = p_shop_id;

  -- Queue numbers are per day: a booking moved to another day joins that day's sequence.
  v_queue := v_b.queue_number;
  if p_date <> v_b.booking_date then
    v_prefix := case when v_b.direction = 'outbound' then 'R' else 'S' end;
    select coalesce(max(nullif(regexp_replace(b.queue_number, '\D', '', 'g'), '')::int), 0) + 1 into v_seq
    from public.bookings b
    where b.shop_id = p_shop_id and b.booking_date = p_date and b.queue_number like v_prefix || '-%';
    v_queue := v_prefix || '-' || lpad(v_seq::text, 3, '0');
  end if;

  update public.bookings b
     set booking_date = p_date,
         queue_number = v_queue,
         start_time = p_start,
         end_time = v_end,
         service_minutes = coalesce(p_service_minutes, b.service_minutes),
         resource_id = v_dock,
         resource_name = (select r.resource_name from public.booking_resources r where r.id = v_dock),
         grace_deadline = (p_date::text || ' ' || p_start::text || '+07')::timestamptz + make_interval(mins => coalesce(v_grace, 30)),
         status = case when b.status = 'late' then 'confirmed'::public.booking_status else b.status end,
         updated_by = p_actor
   where b.id = p_booking_id;

  booking_id := p_booking_id;
  resource_id := v_dock;
  end_time := v_end;
  queue_number := v_queue;
  return next;
end;
$$;

revoke all on function public.move_dock_booking(uuid, uuid, date, time, uuid, uuid, int) from public;
grant execute on function public.move_dock_booking(uuid, uuid, date, time, uuid, uuid, int) to service_role;
