-- Atomic booking operations + derivable link tokens.
--
-- Link tokens are derived server-side: HMAC(TOKEN_SECRET, kind:id:version).
-- The DB stores only sha256(token) for lookup plus the version, so the portal
-- can show the same link / QR again without keeping the raw token, and
-- "regenerate" is version + 1 (the old link dies).

alter table public.external_documents
  add column if not exists booking_token_version int not null default 0;

alter table public.bookings
  add column if not exists driver_token_version int not null default 0;

/*
 * pending -> confirmed, issuing the DO number in the same statement so a lost
 * race never burns a number. Returns no row when the booking is not pending.
 */
create or replace function public.confirm_dock_booking(p_shop_id uuid, p_booking_id uuid, p_actor uuid)
returns table(booking_id uuid, do_number text)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_format text;
  v_do text;
  v_id uuid;
begin
  perform 1 from public.bookings b
   where b.id = p_booking_id and b.shop_id = p_shop_id and b.status = 'pending' and b.is_deleted = false
   for update;
  if not found then
    return;
  end if;

  select coalesce(ss.do_number_format, 'DO-{YYYYMM}-{NNNN}') into v_format
  from public.site_settings ss where ss.shop_id = p_shop_id;
  v_do := public.next_do_number(p_shop_id, coalesce(v_format, 'DO-{YYYYMM}-{NNNN}'));

  update public.bookings b
     set status = 'confirmed',
         confirmed_at = now(), confirmed_by = p_actor,
         do_number = coalesce(b.do_number, v_do),
         do_issued_at = coalesce(b.do_issued_at, now()),
         do_issued_by = coalesce(b.do_issued_by, p_actor),
         updated_by = p_actor
   where b.id = p_booking_id and b.shop_id = p_shop_id and b.status = 'pending'
  returning b.id, b.do_number into v_id, v_do;

  booking_id := v_id;
  do_number := v_do;
  return next;
end;
$$;

/*
 * Move a live booking to another date / time / dock. Serialises on the target
 * day, ignores the booking's own current slot, keeps queue number and DO.
 * p_resource_id null = pick a dock. Raises slot_unavailable | not_movable.
 */
create or replace function public.move_dock_booking(
  p_shop_id uuid,
  p_booking_id uuid,
  p_date date,
  p_start time,
  p_resource_id uuid default null,
  p_actor uuid default null
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
  v_dock uuid;
  v_grace int;
  v_queue text;
  v_prefix text;
  v_seq int;
begin
  perform pg_advisory_xact_lock(hashtext(p_shop_id::text || p_date::text));

  select * into v_b from public.bookings b
   where b.id = p_booking_id and b.shop_id = p_shop_id and b.is_deleted = false
   for update;
  if not found or v_b.status not in ('pending', 'confirmed', 'late') then
    raise exception 'not_movable';
  end if;

  select s.duration_minutes into v_duration from public.services s where s.id = v_b.service_id;
  v_end := (p_date + p_start + make_interval(mins => coalesce(v_duration, 30)))::time;

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
          (p_date + v_end + make_interval(mins => coalesce(v_b.buffer_minutes, 0)))::time, p_booking_id)
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

revoke all on function public.confirm_dock_booking(uuid, uuid, uuid) from public;
revoke all on function public.move_dock_booking(uuid, uuid, date, time, uuid, uuid) from public;
grant execute on function public.confirm_dock_booking(uuid, uuid, uuid) to service_role;
grant execute on function public.move_dock_booking(uuid, uuid, date, time, uuid, uuid) to service_role;
