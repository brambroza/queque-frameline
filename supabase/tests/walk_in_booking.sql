-- ============================================================
-- Smoke test for 202609300001_walk_in_booking.sql
--
--   psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -f supabase/tests/walk_in_booking.sql
--
-- Runs inside one transaction and ROLLS BACK: nothing is kept. Needs a
-- seeded site (1 shop, 1 branch with working hours, 1 outbound vehicle
-- type, 1 dock). Picks a working day 30–60 days ahead that nobody has
-- booked. Any failed check raises and stops the script; the last line
-- printed must be "ALL PASSED".
--
-- The walk-in rules themselves (today only, the running slot) live in the
-- API; this covers what the database must allow and still refuse.
-- ============================================================
begin;

do $$
declare
  v_company uuid; v_shop uuid; v_branch uuid; v_service uuid; v_customer uuid;
  v_date date; v_s1 time; v_s2 time;
  v_so_paid uuid; v_so_unpaid uuid;
  v_id uuid; v_pending uuid;
  v_ok boolean;
  r record;
begin
  select s.company_id, s.id into v_company, v_shop from public.shops s order by s.created_at limit 1;
  select b.id into v_branch from public.branches b where b.shop_id = v_shop and not b.is_deleted order by b.created_at limit 1;
  select sv.id into v_service from public.services sv
   where sv.shop_id = v_shop and not sv.is_deleted and sv.active and (sv.direction is null or sv.direction = 'outbound')
   order by sv.sort_order, sv.created_at limit 1;
  select c.id into v_customer from public.customers c where c.shop_id = v_shop and not c.is_deleted order by c.created_at limit 1;
  if v_shop is null or v_branch is null or v_service is null then
    raise exception 'seed data missing (need shop, branch, vehicle type)';
  end if;
  -- A fresh chain has no partners yet; one throwaway customer is enough (rolled back with the rest).
  if v_customer is null then
    insert into public.customers (company_id, shop_id, partner_type, full_name, code)
    values (v_company, v_shop, 'customer', 'ทดสอบ Walk-in', 'TEST-WALKIN') returning id into v_customer;
  end if;

  -- a working day far enough ahead that nobody has booked it, with at least 2 slots
  select d::date into v_date
  from generate_series(current_date + 30, current_date + 60, interval '1 day') d
  where not exists (select 1 from public.bookings k where k.shop_id = v_shop and k.booking_date = d::date and not k.is_deleted)
    and (select count(*) from public.get_dock_slots(v_shop, v_branch, 'outbound', v_service, d::date) s where s.remaining_capacity > 0) >= 2
  order by d limit 1;
  if v_date is null then raise exception 'no free working day found 30–60 days ahead'; end if;
  select s.slot_time into v_s1 from public.get_dock_slots(v_shop, v_branch, 'outbound', v_service, v_date) s where s.remaining_capacity > 0 order by s.slot_time limit 1;
  select s.slot_time into v_s2 from public.get_dock_slots(v_shop, v_branch, 'outbound', v_service, v_date) s where s.remaining_capacity > 0 order by s.slot_time desc limit 1;

  insert into public.external_documents (company_id, shop_id, branch_id, doc_type, doc_no, partner_id, partner_name, status, source, payment_status)
  values (v_company, v_shop, v_branch, 'so', 'SO-TEST-WALKIN-PAID', v_customer, 'ทดสอบ', 'open', 'manual', 'paid') returning id into v_so_paid;
  insert into public.external_documents (company_id, shop_id, branch_id, doc_type, doc_no, partner_id, partner_name, status, source, payment_status)
  values (v_company, v_shop, v_branch, 'so', 'SO-TEST-WALKIN-UNPAID', v_customer, 'ทดสอบ', 'open', 'manual', 'unpaid') returning id into v_so_unpaid;

  -- 1. The source constraint takes 'walk_in' and still refuses anything unknown.
  begin
    insert into public.bookings (company_id, shop_id, branch_id, direction, service_id, customer_id, booking_date, start_time, end_time, status, booking_source, queue_number, plate_number)
    values (v_company, v_shop, v_branch, 'outbound', v_service, v_customer, v_date, v_s1, v_s1 + interval '30 minutes', 'pending', 'gate', 'R-990', 'TEST990');
    raise exception 'FAIL 1: unknown booking_source accepted';
  exception when check_violation then
    null;
  end;
  raise notice 'ok 1  unknown booking_source refused';

  -- 2. A paid walk-in is created confirmed, with its dock and DO, tagged walk_in.
  select k.booking_id into v_id
  from public.create_dock_booking(v_shop, v_branch, 'outbound', v_service, v_date, v_s1, v_customer, 'TEST991', 'confirmed', 'walk_in', null, v_so_paid) k;
  select k.status::text as status, k.booking_source, k.do_number, k.resource_id into r from public.bookings k where k.id = v_id;
  if v_id is null or r.status <> 'confirmed' or r.booking_source <> 'walk_in' or r.do_number is null or r.resource_id is null then
    raise exception 'FAIL 2: expected confirmed walk_in with DO and dock, got % / % / % / %', r.status, r.booking_source, r.do_number, r.resource_id;
  end if;
  raise notice 'ok 2  paid walk-in created confirmed · %', r.do_number;

  -- 3. Checking it in at once passes the overlap guard and the payment gate.
  update public.bookings set status = 'checked_in', arrived_at = now(), checked_in_at = now() where id = v_id and status in ('confirmed', 'late');
  select k.status::text as status, k.checked_in_at into r from public.bookings k where k.id = v_id;
  if r.status <> 'checked_in' or r.checked_in_at is null then raise exception 'FAIL 3: check-in did not land (%)', r.status; end if;
  raise notice 'ok 3  walk-in checked in straight after the confirm';

  -- 4. An unpaid SO can never start confirmed, walk-in or not.
  begin
    perform public.create_dock_booking(v_shop, v_branch, 'outbound', v_service, v_date, v_s2, v_customer, 'TEST992', 'confirmed', 'walk_in', null, v_so_unpaid);
    raise exception 'FAIL 4: unpaid walk-in was confirmed';
  exception when others then
    if sqlerrm not like '%payment_required%' then raise; end if;
  end;
  raise notice 'ok 4  unpaid walk-in refused as confirmed (payment_required)';

  -- 5. It waits as pending instead, without a DO, and the unpaid sweep leaves it alone.
  select k.booking_id into v_pending
  from public.create_dock_booking(v_shop, v_branch, 'outbound', v_service, v_date, v_s2, v_customer, 'TEST992', 'pending', 'walk_in', null, v_so_unpaid) k;
  select public.cancel_unpaid_booking(v_shop, v_pending, 'x') into v_ok;
  select k.status::text as status, k.do_number into r from public.bookings k where k.id = v_pending;
  if v_ok or r.status <> 'pending' or r.do_number is not null then raise exception 'FAIL 5: pending walk-in touched (% / % / %)', v_ok, r.status, r.do_number; end if;
  raise notice 'ok 5  unpaid walk-in waits as pending and is not auto-cancelled';

  -- 6. Payment recorded: approve, then check in — the path PATCH /api/bookings takes.
  update public.external_documents set payment_status = 'paid', payment_updated_at = now() where id = v_so_unpaid;
  perform public.confirm_dock_booking(v_shop, v_pending, null);
  update public.bookings set status = 'checked_in', arrived_at = now(), checked_in_at = now() where id = v_pending and status in ('confirmed', 'late');
  select k.status::text as status, k.do_number into r from public.bookings k where k.id = v_pending;
  if r.status <> 'checked_in' or r.do_number is null then raise exception 'FAIL 6: expected checked_in with DO, got % / %', r.status, r.do_number; end if;
  raise notice 'ok 6  approved after payment, DO issued, checked in';

  raise notice 'ALL PASSED';
end $$;

rollback;
