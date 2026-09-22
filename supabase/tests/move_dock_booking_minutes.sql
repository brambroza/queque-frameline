-- ============================================================
-- Smoke test for 202609220003_move_dock_booking_minutes.sql
--
--   psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -f supabase/tests/move_dock_booking_minutes.sql
--
-- Runs inside one transaction and ROLLS BACK: nothing is kept. Needs a
-- seeded site (1 shop, 1 branch with working hours, 1 outbound vehicle
-- type, 1 dock). Picks a working day 30–60 days ahead that nobody has
-- booked. The last line printed must be "ALL PASSED".
-- ============================================================
begin;

do $$
declare
  v_company uuid; v_shop uuid; v_branch uuid; v_service uuid; v_customer uuid; v_dock uuid;
  v_date date; v_s1 time; v_s2 time; v_s3 time;
  v_id uuid; v_other uuid;
  v_vehicle_minutes int;
  r record;
begin
  select s.company_id, s.id into v_company, v_shop from public.shops s order by s.created_at limit 1;
  select b.id into v_branch from public.branches b where b.shop_id = v_shop and not b.is_deleted order by b.created_at limit 1;
  select sv.id, sv.duration_minutes into v_service, v_vehicle_minutes from public.services sv
   where sv.shop_id = v_shop and not sv.is_deleted and sv.active and (sv.direction is null or sv.direction = 'outbound')
   order by sv.sort_order, sv.created_at limit 1;
  select c.id into v_customer from public.customers c where c.shop_id = v_shop order by c.created_at limit 1;
  if v_shop is null or v_branch is null or v_service is null then
    raise exception 'seed data missing (need shop, branch, vehicle type)';
  end if;
  if v_customer is null then
    insert into public.customers (company_id, shop_id) values (v_company, v_shop) returning id into v_customer;
  end if;

  -- a working day far enough ahead that nobody has booked it, with at least 3 slots
  select d::date into v_date
  from generate_series(current_date + 30, current_date + 60, interval '1 day') d
  where not exists (select 1 from public.bookings k where k.shop_id = v_shop and k.booking_date = d::date and not k.is_deleted)
    and (select count(*) from public.get_dock_slots(v_shop, v_branch, 'outbound', v_service, d::date) s where s.remaining_capacity > 0) >= 3
  order by d limit 1;
  if v_date is null then raise exception 'no free working day found 30–60 days ahead'; end if;

  select s.slot_time into v_s1 from public.get_dock_slots(v_shop, v_branch, 'outbound', v_service, v_date) s where s.remaining_capacity > 0 order by s.slot_time limit 1;
  select s.slot_time into v_s2 from public.get_dock_slots(v_shop, v_branch, 'outbound', v_service, v_date) s where s.remaining_capacity > 0 and s.slot_time > v_s1 order by s.slot_time limit 1;
  select s.slot_time into v_s3 from public.get_dock_slots(v_shop, v_branch, 'outbound', v_service, v_date) s where s.remaining_capacity > 0 and s.slot_time > v_s2 + interval '2 hours' order by s.slot_time limit 1;
  if v_s3 is null then
    select s.slot_time into v_s3 from public.get_dock_slots(v_shop, v_branch, 'outbound', v_service, v_date) s where s.remaining_capacity > 0 order by s.slot_time desc limit 1;
  end if;

  -- queue under test at the first slot, confirmed, dock from the RPC
  select k.booking_id, k.resource_id into v_id, v_dock
  from public.create_dock_booking(v_shop, v_branch, 'outbound', v_service, v_date, v_s1, v_customer, 'ทดสอบ', 'confirmed', 'staff', null) k;
  if v_id is null then raise exception 'FAIL setup: create_dock_booking returned nothing'; end if;

  -- 1. move + minutes in one call: date/time move and service_minutes both land
  perform public.move_dock_booking(v_shop, v_id, v_date, v_s3, v_dock, null, 90);
  select k.start_time, k.end_time, k.service_minutes, k.resource_id into r from public.bookings k where k.id = v_id;
  if r.start_time <> v_s3 or r.service_minutes <> 90 or r.end_time <> (v_s3 + interval '90 minutes')::time or r.resource_id <> v_dock then
    raise exception 'FAIL 1: expected % / 90 min / end %, got % / % / %', v_s3, (v_s3 + interval '90 minutes')::time, r.start_time, r.service_minutes, r.end_time;
  end if;
  raise notice 'ok 1  move to % with 90 minutes -> start %, end %, service_minutes %', v_s3, r.start_time, r.end_time, r.service_minutes;

  -- 2. move without minutes keeps the queue's own service_minutes (90), not the vehicle default
  perform public.move_dock_booking(v_shop, v_id, v_date, v_s1, v_dock);
  select k.start_time, k.end_time, k.service_minutes into r from public.bookings k where k.id = v_id;
  if r.service_minutes <> 90 or r.end_time <> (v_s1 + interval '90 minutes')::time then
    raise exception 'FAIL 2: minutes should stay 90 (vehicle default %), got % end %', v_vehicle_minutes, r.service_minutes, r.end_time;
  end if;
  raise notice 'ok 2  move without minutes keeps 90';

  -- 3. out-of-range minutes refused before anything changes
  begin
    perform public.move_dock_booking(v_shop, v_id, v_date, v_s3, v_dock, null, 3);
    raise exception 'FAIL 3: 3 minutes was accepted';
  exception when others then
    if sqlerrm not like '%invalid_minutes%' then raise; end if;
  end;
  select k.start_time into r from public.bookings k where k.id = v_id;
  if r.start_time <> v_s1 then raise exception 'FAIL 3: queue moved despite invalid minutes'; end if;
  raise notice 'ok 3  invalid_minutes leaves the queue untouched';

  -- 4. a second queue right after: moving with minutes long enough to reach it is refused as a whole
  insert into public.bookings (company_id, shop_id, branch_id, service_id, customer_id, booking_date, start_time, end_time,
                               queue_number, status, resource_id, direction, buffer_minutes)
  values (v_company, v_shop, v_branch, v_service, v_customer, v_date, v_s2 + interval '1 hour', v_s2 + interval '1 hour 30 minutes', 'T-NEXT', 'confirmed', v_dock, 'outbound', 0)
  returning id into v_other;
  begin
    perform public.move_dock_booking(v_shop, v_id, v_date, v_s2, v_dock, null, 240);
    raise exception 'FAIL 4: move + 240 minutes over the next queue was accepted';
  exception when others then
    if sqlerrm not like '%slot_unavailable%' and sqlerrm not like '%dock_conflict%' then raise; end if;
  end;
  select k.start_time, k.service_minutes into r from public.bookings k where k.id = v_id;
  if r.start_time <> v_s1 or r.service_minutes <> 90 then raise exception 'FAIL 4: refused move changed the queue (% / %)', r.start_time, r.service_minutes; end if;
  raise notice 'ok 4  move + minutes that hit the next queue is refused atomically';

  raise notice 'ALL PASSED';
end $$;

rollback;
