-- ============================================================
-- Dock overlap guard (2026-09-21)
--
-- Two queues may overlap in time only when they are on DIFFERENT docks.
-- Booking, reschedule and dock-time changes already enforce that through
-- is_dock_free; approval did not (it only checked when the minutes changed),
-- and nothing at table level stopped a direct write from planting an overlap.
--
-- 1. confirm_dock_booking — takes the day lock and re-checks the dock on every
--    approval. Raises dock_conflict.
-- 2. bookings_dock_overlap_guard trigger — last line of defence for every
--    write that places or moves a queue on a dock. Raises dock_conflict.
-- ============================================================

/*
 * The dock block of a queue ends at end_time + buffer, capped at the end of
 * the day (same rule as booking_end_for_minutes). A missing end_time counts as
 * 30 minutes, matching is_dock_free.
 */
create or replace function public.booking_block_end(p_date date, p_start time, p_end time, p_buffer_minutes int)
returns time
language sql
immutable
as $$
  select least(
    p_date + coalesce(p_end, p_start + interval '30 minutes') + make_interval(mins => coalesce(p_buffer_minutes, 0)),
    p_date + time '23:59:59'
  )::time;
$$;

/*
 * Approve a pending queue: payment gate, dock re-check, optional dock-time
 * change, status and DO number in one transaction so a refused approval never
 * burns a DO number.
 * Raises payment_required | dock_conflict | duration_conflict | invalid_minutes.
 */
create or replace function public.confirm_dock_booking(p_shop_id uuid, p_booking_id uuid, p_actor uuid, p_service_minutes int default null)
returns table(booking_id uuid, do_number text, end_time time, service_minutes int)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_b public.bookings%rowtype;
  v_format text;
  v_do text;
  v_id uuid;
  v_end time;
  v_minutes int;
begin
  select * into v_b from public.bookings b
   where b.id = p_booking_id and b.shop_id = p_shop_id and b.status = 'pending' and b.is_deleted = false
   for update;
  if not found then
    return;
  end if;

  if not public.document_payment_ok(v_b.document_id) then
    raise exception 'payment_required';
  end if;

  -- Same lock order as the other dock functions: row lock, then day lock.
  perform pg_advisory_xact_lock(hashtext(p_shop_id::text || v_b.booking_date::text));

  v_end := v_b.end_time;
  v_minutes := v_b.service_minutes;
  if p_service_minutes is not null and p_service_minutes is distinct from v_b.service_minutes then
    v_end := public.booking_end_for_minutes(p_shop_id, p_booking_id, p_service_minutes);
    v_minutes := p_service_minutes;
  elsif v_b.resource_id is not null
     and not public.is_dock_free(
       p_shop_id, v_b.resource_id, v_b.booking_date, v_b.start_time,
       public.booking_block_end(v_b.booking_date, v_b.start_time, v_b.end_time, v_b.buffer_minutes),
       p_booking_id) then
    raise exception 'dock_conflict';
  end if;

  select coalesce(ss.do_number_format, 'DO-{YYYYMM}-{NNNN}') into v_format
  from public.site_settings ss where ss.shop_id = p_shop_id;
  v_do := public.next_do_number(p_shop_id, coalesce(v_format, 'DO-{YYYYMM}-{NNNN}'));

  update public.bookings b
     set status = 'confirmed',
         confirmed_at = now(), confirmed_by = p_actor,
         end_time = v_end,
         service_minutes = v_minutes,
         do_number = coalesce(b.do_number, v_do),
         do_issued_at = coalesce(b.do_issued_at, now()),
         do_issued_by = coalesce(b.do_issued_by, p_actor),
         updated_by = p_actor
   where b.id = p_booking_id and b.shop_id = p_shop_id and b.status = 'pending'
  returning b.id, b.do_number into v_id, v_do;

  booking_id := v_id;
  do_number := v_do;
  end_time := v_end;
  service_minutes := v_minutes;
  return next;
end;
$$;

/*
 * Refuses any write that would put two live queues on the same dock at the
 * same time. Only fires when the queue is placed or moved (insert, dock / date
 * / time / buffer change, or a closed or deleted queue coming back to life) —
 * plain status steps are never blocked, so a late day at the dock still flows.
 */
create or replace function public.bookings_dock_overlap_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_closed constant public.booking_status[] := array['cancelled', 'no_show', 'skipped', 'completed']::public.booking_status[];
begin
  if new.resource_id is null or new.is_deleted or new.status = any (v_closed) then
    return new;
  end if;

  if tg_op = 'UPDATE'
     and old.resource_id is not distinct from new.resource_id
     and old.booking_date = new.booking_date
     and old.start_time = new.start_time
     and old.end_time is not distinct from new.end_time
     and coalesce(old.buffer_minutes, 0) = coalesce(new.buffer_minutes, 0)
     and not old.is_deleted
     and not (old.status = any (v_closed)) then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtext(new.shop_id::text || new.booking_date::text));

  if not public.is_dock_free(
       new.shop_id, new.resource_id, new.booking_date, new.start_time,
       public.booking_block_end(new.booking_date, new.start_time, new.end_time, new.buffer_minutes),
       new.id) then
    raise exception 'dock_conflict';
  end if;
  return new;
end;
$$;

drop trigger if exists bookings_dock_overlap_guard on public.bookings;
create trigger bookings_dock_overlap_guard
  before insert or update of status, resource_id, booking_date, start_time, end_time, buffer_minutes, is_deleted
  on public.bookings
  for each row execute function public.bookings_dock_overlap_guard();

revoke all on function public.confirm_dock_booking(uuid, uuid, uuid, int) from public;
revoke all on function public.bookings_dock_overlap_guard() from public;
grant execute on function public.confirm_dock_booking(uuid, uuid, uuid, int) to service_role;
grant execute on function public.booking_block_end(date, time, time, int) to authenticated, service_role;
