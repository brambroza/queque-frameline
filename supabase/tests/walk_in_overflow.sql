-- ============================================================
-- Smoke test for 202610010001_walk_in_overflow.sql
--
--   psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -f supabase/tests/walk_in_overflow.sql
--
-- Runs inside one transaction and ROLLS BACK: nothing is kept. Needs the
-- Fameline seed (1 shop, 1 branch with Mon–Fri hours, a 30-minute outbound
-- vehicle type, 2 docks that take it). Picks a working day 30–60 days ahead
-- that nobody has booked. Any failed check raises and stops the script; the
-- last line printed must be "ALL PASSED".
-- ============================================================
begin;

do $$
declare
  v_company uuid; v_shop uuid; v_branch uuid; v_service uuid; v_customer uuid;
  v_date date; v_close time; v_last time; v_cap int;
  v_a uuid; v_b uuid; v_w1 uuid; v_w2 uuid;
  v_n int; v_n2 int; v_t time; v_dur int;
  r record;
begin
  select s.company_id, s.id into v_company, v_shop from public.shops s order by s.created_at limit 1;
  select b.id into v_branch from public.branches b where b.shop_id = v_shop and not b.is_deleted order by b.created_at limit 1;
  select sv.id, sv.duration_minutes into v_service, v_dur from public.services sv
   where sv.shop_id = v_shop and not sv.is_deleted and sv.active and (sv.direction is null or sv.direction = 'outbound')
   order by sv.sort_order, sv.created_at limit 1;
  select c.id into v_customer from public.customers c where c.shop_id = v_shop and not c.is_deleted order by c.created_at limit 1;
  if v_shop is null or v_branch is null or v_service is null then
    raise exception 'seed data missing (need shop, branch, vehicle type)';
  end if;
  if v_customer is null then
    insert into public.customers (company_id, shop_id, partner_type, full_name, code)
    values (v_company, v_shop, 'customer', 'ทดสอบ Overflow', 'TEST-OVERFLOW') returning id into v_customer;
  end if;

  select d::date into v_date
  from generate_series(current_date + 30, current_date + 60, interval '1 day') d
  where not exists (select 1 from public.bookings k where k.shop_id = v_shop and k.booking_date = d::date and not k.is_deleted)
    and (select count(*) from public.get_dock_slots(v_shop, v_branch, 'outbound', v_service, d::date) s where s.remaining_capacity > 0) >= 2
  order by d limit 1;
  if v_date is null then raise exception 'no free working day found 30–60 days ahead'; end if;

  select wh.close_time into v_close from public.working_hours wh
   where wh.shop_id = v_shop and wh.weekday = extract(dow from v_date)::int and wh.active and not wh.is_deleted
     and (wh.branch_id = v_branch or wh.branch_id is null) and (wh.direction is null or wh.direction = 'outbound')
   order by (wh.direction is not null) desc, (wh.branch_id = v_branch) desc limit 1;

  -- 1. Default call: the old grid, nothing after closing, no overflow flag anywhere.
  select max(s.slot_time), count(*) filter (where s.overflow), max(s.capacity) into v_last, v_n, v_cap
  from public.get_dock_slots(v_shop, v_branch, 'outbound', v_service, v_date) s;
  if v_n <> 0 or (v_date + v_last + make_interval(mins => v_dur)) > (v_date + v_close) then
    raise exception 'FAIL 1: default grid leaked overflow slots (last % / overflow rows %)', v_last, v_n;
  end if;
  if v_cap < 2 then raise exception 'FAIL 1: need at least 2 eligible docks, got %', v_cap; end if;
  raise notice 'ok 1  default grid ends at % (closing %), capacity %', v_last, v_close, v_cap;

  -- 2. Overflow on an empty day: extra slots after closing, flagged, with every dock free.
  select count(*) filter (where s.overflow), count(*) filter (where s.overflow and s.remaining_capacity <> v_cap),
         count(*) filter (where s.overflow and s.slot_end <= v_close)
    into v_n, v_n2, v_cap
  from public.get_dock_slots(v_shop, v_branch, 'outbound', v_service, v_date, null, null, true) s;
  if v_n = 0 or v_n2 <> 0 or v_cap <> 0 then
    raise exception 'FAIL 2: overflow rows % / wrong capacity % / ending before close %', v_n, v_n2, v_cap;
  end if;
  raise notice 'ok 2  overflow grid adds % slot(s) after closing, all free', v_n;

  -- 3. Fill the last regular slot on every dock, so the day is "full" at the end.
  select s.capacity into v_cap from public.get_dock_slots(v_shop, v_branch, 'outbound', v_service, v_date) s where s.slot_time = v_last;
  select k.booking_id into v_a from public.create_dock_booking(v_shop, v_branch, 'outbound', v_service, v_date, v_last, v_customer, 'TEST-A', 'confirmed', 'admin') k;
  select k.booking_id into v_b from public.create_dock_booking(v_shop, v_branch, 'outbound', v_service, v_date, v_last, v_customer, 'TEST-B', 'confirmed', 'admin') k;
  select s.remaining_capacity into v_n from public.get_dock_slots(v_shop, v_branch, 'outbound', v_service, v_date) s where s.slot_time = v_last;
  if v_n <> 0 then raise exception 'FAIL 3: last regular slot should be full, remaining %', v_n; end if;
  raise notice 'ok 3  last regular slot % full on % dock(s)', v_last, v_cap;

  -- 4. A plain create (customer link / admin) may not take an overflow slot.
  select min(s.slot_time) into v_t
  from public.get_dock_slots(v_shop, v_branch, 'outbound', v_service, v_date, null, null, true) s
  where s.overflow and s.remaining_capacity > 0;
  if v_t is null then raise exception 'FAIL 4: no free overflow slot after filling the day'; end if;
  begin
    perform public.create_dock_booking(v_shop, v_branch, 'outbound', v_service, v_date, v_t, v_customer, 'TEST-X', 'confirmed', 'admin');
    raise exception 'FAIL 4: non-walk-in booked an overflow slot';
  exception when others then
    if sqlerrm not like '%slot_unavailable%' then raise; end if;
  end;
  raise notice 'ok 4  overflow slot % refused for a regular booking', v_t;

  -- 5. A walk-in takes it: a dock is assigned and the queue is confirmed with a DO.
  select k.booking_id into v_w1
  from public.create_dock_booking(v_shop, v_branch, 'outbound', v_service, v_date, v_t, v_customer, 'TEST-W1', 'confirmed', 'walk_in',
                                  null, null, null, null, null, null, null, null, true) k;
  select k.status::text as status, k.resource_id, k.do_number, k.start_time into r from public.bookings k where k.id = v_w1;
  if r.status <> 'confirmed' or r.resource_id is null or r.do_number is null or r.start_time <> v_t then
    raise exception 'FAIL 5: walk-in overflow booking wrong (% / % / % / %)', r.status, r.resource_id, r.do_number, r.start_time;
  end if;
  raise notice 'ok 5  walk-in queued after the last booking at % on dock %', v_t, r.resource_id;

  -- 6. Capacity still applies in overflow: once every dock has a queue at that time, the slot is full,
  --    and the overflow grid moves on to the next free time after the new tail.
  select k.booking_id into v_w2
  from public.create_dock_booking(v_shop, v_branch, 'outbound', v_service, v_date, v_t, v_customer, 'TEST-W2', 'confirmed', 'walk_in',
                                  null, null, null, null, null, null, null, null, true) k;
  begin
    perform public.create_dock_booking(v_shop, v_branch, 'outbound', v_service, v_date, v_t, v_customer, 'TEST-W3', 'confirmed', 'walk_in',
                                       null, null, null, null, null, null, null, null, true);
    raise exception 'FAIL 6: third walk-in squeezed into a full overflow slot';
  exception when others then
    if sqlerrm not like '%slot_unavailable%' then raise; end if;
  end;
  select min(s.slot_time) into v_t
  from public.get_dock_slots(v_shop, v_branch, 'outbound', v_service, v_date, null, null, true) s
  where s.overflow and s.remaining_capacity > 0;
  select max(k.end_time) into v_last from public.bookings k where k.id in (v_w1, v_w2);
  if v_t is null or v_t < v_last then raise exception 'FAIL 6: next overflow slot % should start at/after the new tail %', v_t, v_last; end if;
  raise notice 'ok 6  overflow slot full after % walk-ins; next free overflow slot %', 2, v_t;

  -- 7. Overflow never crosses midnight: a queue blocking a dock until late leaves slots ending by 23:59.
  update public.bookings set start_time = '22:30', end_time = '23:30' where id = v_w2;
  select max(s.slot_end), count(*) into v_t, v_n
  from public.get_dock_slots(v_shop, v_branch, 'outbound', v_service, v_date, null, null, true) s;
  if v_t > time '23:59' or v_n = 0 then raise exception 'FAIL 7: overflow grid crossed midnight (last end %)', v_t; end if;
  raise notice 'ok 7  overflow grid capped at % (% rows)', v_t, v_n;

  -- 8. Positional callers of get_dock_slots still work after the signature change.
  select count(*) into v_n from public.get_available_days(v_shop, v_branch, 'outbound', v_service, v_date, v_date);
  if v_n <> 1 then raise exception 'FAIL 8: get_available_days broke (% rows)', v_n; end if;
  perform public.move_dock_booking(v_shop, v_a, v_date, (select min(s.slot_time) from public.get_dock_slots(v_shop, v_branch, 'outbound', v_service, v_date) s where s.remaining_capacity > 0));
  raise notice 'ok 8  get_available_days + move_dock_booking still work';

  raise notice 'ALL PASSED';
end $$;

rollback;
