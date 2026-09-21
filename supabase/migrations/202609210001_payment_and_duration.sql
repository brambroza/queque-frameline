-- Payment gate for SO + per-booking dock time.
--
-- 1. external_documents.payment_status (unpaid | paid | credit). A customer may
--    book against an unpaid SO, but the queue cannot be confirmed (no DO) until
--    the warehouse / admin records the payment. PO (supplier delivery) is never gated.
-- 2. bookings.service_minutes: time at the dock for this queue. Starts from the
--    vehicle type's duration; the warehouse may change it when approving, because
--    real picking time differs from the default.

-- ---------------------------------------------------------------------------
-- Columns
-- ---------------------------------------------------------------------------
alter table public.external_documents
  add column if not exists payment_status text not null default 'unpaid',
  add column if not exists payment_ref text,
  add column if not exists payment_note text,
  add column if not exists payment_updated_at timestamptz,
  add column if not exists payment_updated_by uuid;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'external_documents_payment_status_check') then
    alter table public.external_documents
      add constraint external_documents_payment_status_check check (payment_status in ('unpaid', 'paid', 'credit'));
  end if;
end $$;

comment on column public.external_documents.payment_status is 'SO only: unpaid blocks queue confirmation; paid / credit allow it. Ignored for PO.';

alter table public.bookings
  add column if not exists service_minutes int;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'bookings_service_minutes_range') then
    alter table public.bookings
      add constraint bookings_service_minutes_range check (service_minutes is null or service_minutes between 5 and 1440);
  end if;
end $$;

comment on column public.bookings.service_minutes is 'Minutes at the dock for this queue (defaults to the vehicle type, adjustable on approval). end_time = start_time + service_minutes.';

-- Existing SOs whose queue was already approved must not become blocked retroactively.
update public.external_documents d
   set payment_status = 'paid', payment_note = 'ตั้งค่าอัตโนมัติ: มีคิวที่อนุมัติแล้วก่อนเปิดใช้การตรวจการชำระเงิน', payment_updated_at = now()
 where d.doc_type = 'so'
   and d.payment_status = 'unpaid'
   and exists (
     select 1 from public.bookings b
     where b.document_id = d.id and b.is_deleted = false
       and b.status in ('confirmed', 'late', 'checked_in', 'called', 'serving', 'completed')
   );

update public.bookings b
   set service_minutes = greatest(5, least(1440, (extract(epoch from (b.end_time - b.start_time)) / 60)::int))
 where b.service_minutes is null and b.end_time is not null and b.end_time > b.start_time;

create index if not exists external_documents_payment_idx
  on public.external_documents (shop_id, doc_type, payment_status) where is_deleted = false;

-- ---------------------------------------------------------------------------
-- Payment gate
-- ---------------------------------------------------------------------------
create or replace function public.document_payment_ok(p_document_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_document_id is null
      or coalesce((
           select d.doc_type <> 'so' or d.payment_status in ('paid', 'credit')
           from public.external_documents d where d.id = p_document_id
         ), true);
$$;

/*
 * Last line of defence for every path that can make a queue "confirmed"
 * (approve, admin-created queue, customer booking with auto-confirm): the row
 * is refused while its SO is unpaid. Also snapshots service_minutes on insert.
 */
create or replace function public.bookings_payment_gate()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' and new.service_minutes is null and new.end_time is not null and new.end_time > new.start_time then
    new.service_minutes := greatest(5, least(1440, (extract(epoch from (new.end_time - new.start_time)) / 60)::int));
  end if;

  if new.status = 'confirmed'
     and (tg_op = 'INSERT' or old.status = 'pending')
     and not public.document_payment_ok(new.document_id) then
    raise exception 'payment_required';
  end if;
  return new;
end;
$$;

drop trigger if exists bookings_payment_gate on public.bookings;
create trigger bookings_payment_gate
  before insert or update of status on public.bookings
  for each row execute function public.bookings_payment_gate();

-- ---------------------------------------------------------------------------
-- Dock time
-- ---------------------------------------------------------------------------
/*
 * End time for `p_minutes` at the dock, or raises duration_conflict when the
 * longer stay (plus the turnaround buffer) would overlap another queue on the
 * same dock or run past midnight. Closing time and breaks are NOT enforced
 * here: the warehouse decides on purpose when it extends a job.
 * Caller must hold the row lock; this takes the day lock.
 */
create or replace function public.booking_end_for_minutes(p_shop_id uuid, p_booking_id uuid, p_minutes int)
returns time
language plpgsql
security definer
set search_path = public
as $$
declare
  v_b public.bookings%rowtype;
  v_end_ts timestamp;
  v_block_ts timestamp;
begin
  if p_minutes is null or p_minutes < 5 or p_minutes > 1440 then
    raise exception 'invalid_minutes';
  end if;

  select * into v_b from public.bookings b where b.id = p_booking_id and b.shop_id = p_shop_id and b.is_deleted = false;
  if not found then
    raise exception 'not_found';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_shop_id::text || v_b.booking_date::text));

  v_end_ts := v_b.booking_date + v_b.start_time + make_interval(mins => p_minutes);
  if v_end_ts::date <> v_b.booking_date then
    raise exception 'duration_conflict';
  end if;
  v_block_ts := least(v_end_ts + make_interval(mins => coalesce(v_b.buffer_minutes, 0)), v_b.booking_date + time '23:59:59');

  if v_b.resource_id is not null
     and not public.is_dock_free(p_shop_id, v_b.resource_id, v_b.booking_date, v_b.start_time, v_block_ts::time, p_booking_id) then
    raise exception 'duration_conflict';
  end if;

  return v_end_ts::time;
end;
$$;

/*
 * Approve a pending queue: payment gate, optional dock-time change, status and
 * DO number in one transaction so a refused approval never burns a DO number.
 * Raises payment_required | duration_conflict | invalid_minutes.
 */
drop function if exists public.confirm_dock_booking(uuid, uuid, uuid);

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

  v_end := v_b.end_time;
  v_minutes := v_b.service_minutes;
  if p_service_minutes is not null and p_service_minutes is distinct from v_b.service_minutes then
    v_end := public.booking_end_for_minutes(p_shop_id, p_booking_id, p_service_minutes);
    v_minutes := p_service_minutes;
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

/* Change the dock time of a queue that has not started yet. Raises not_adjustable | duration_conflict | invalid_minutes. */
create or replace function public.set_booking_service_minutes(p_shop_id uuid, p_booking_id uuid, p_minutes int, p_actor uuid)
returns table(booking_id uuid, end_time time, service_minutes int)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_status public.booking_status;
  v_end time;
begin
  select b.status into v_status from public.bookings b
   where b.id = p_booking_id and b.shop_id = p_shop_id and b.is_deleted = false
   for update;
  if not found or v_status not in ('pending', 'confirmed', 'late', 'checked_in', 'called', 'serving') then
    raise exception 'not_adjustable';
  end if;

  v_end := public.booking_end_for_minutes(p_shop_id, p_booking_id, p_minutes);

  update public.bookings b
     set end_time = v_end, service_minutes = p_minutes, updated_by = p_actor
   where b.id = p_booking_id and b.shop_id = p_shop_id;

  booking_id := p_booking_id;
  end_time := v_end;
  service_minutes := p_minutes;
  return next;
end;
$$;

/*
 * Same as 202609170005 but the stay length comes from the queue's own
 * service_minutes, so an adjusted dock time survives a reschedule.
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
  v_end_ts timestamp;
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
  v_duration := coalesce(v_b.service_minutes, v_duration, 30);
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

revoke all on function public.confirm_dock_booking(uuid, uuid, uuid, int) from public;
revoke all on function public.set_booking_service_minutes(uuid, uuid, int, uuid) from public;
revoke all on function public.booking_end_for_minutes(uuid, uuid, int) from public;
grant execute on function public.confirm_dock_booking(uuid, uuid, uuid, int) to service_role;
grant execute on function public.set_booking_service_minutes(uuid, uuid, int, uuid) to service_role;
grant execute on function public.booking_end_for_minutes(uuid, uuid, int) to service_role;
grant execute on function public.document_payment_ok(uuid) to authenticated, service_role;
