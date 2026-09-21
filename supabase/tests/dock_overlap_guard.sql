-- ============================================================
-- Smoke test for 202609210002_dock_overlap_guard.sql
--
--   psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -f supabase/tests/dock_overlap_guard.sql
--
-- Runs inside one transaction and ROLLS BACK: nothing is kept. It needs a
-- seeded site (1 shop, 2 docks, 1 vehicle type) and works on a
-- far-future date so it never collides with real queues. Any failed check
-- raises and stops the script; the last line printed must be "ALL PASSED".
-- ============================================================
begin;

do $$
declare
  c_date constant date := date '2099-01-05';
  v_company uuid; v_shop uuid; v_branch uuid; v_service uuid; v_customer uuid;
  v_dock_a uuid; v_dock_b uuid;
  v_a uuid; v_b uuid; v_c uuid; v_d uuid;
  v_do_before bigint; v_do_after bigint;
  v_rows int;
begin
  select s.company_id, s.id into v_company, v_shop from public.shops s order by s.created_at limit 1;
  select r.id, r.branch_id into v_dock_a, v_branch from public.booking_resources r
   where r.shop_id = v_shop and r.resource_type = 'dock' and not r.is_deleted order by r.resource_code limit 1;
  select r.id into v_dock_b from public.booking_resources r
   where r.shop_id = v_shop and r.resource_type = 'dock' and not r.is_deleted and r.id <> v_dock_a order by r.resource_code limit 1;
  select sv.id into v_service from public.services sv where sv.shop_id = v_shop order by sv.created_at limit 1;
  select c.id into v_customer from public.customers c where c.shop_id = v_shop order by c.created_at limit 1;
  if v_shop is null or v_dock_a is null or v_dock_b is null or v_service is null then
    raise exception 'seed data missing (need shop, 2 docks, vehicle type)';
  end if;
  if v_customer is null then -- a fresh seed has no partner yet; rolled back with everything else
    insert into public.customers (company_id, shop_id) values (v_company, v_shop) returning id into v_customer;
  end if;

  -- A: confirmed 09:00–09:45 buffer 10 on dock A  → blocks dock A until 09:55
  insert into public.bookings (company_id, shop_id, branch_id, service_id, customer_id, booking_date, start_time, end_time,
                               queue_number, status, resource_id, direction, buffer_minutes)
  values (v_company, v_shop, v_branch, v_service, v_customer, c_date, '09:00', '09:45', 'T-A', 'confirmed', v_dock_a, 'outbound', 10)
  returning id into v_a;

  -- 1. trigger: insert overlapping queue on the same dock is refused
  begin
    insert into public.bookings (company_id, shop_id, branch_id, service_id, customer_id, booking_date, start_time, end_time,
                                 queue_number, status, resource_id, direction, buffer_minutes)
    values (v_company, v_shop, v_branch, v_service, v_customer, c_date, '09:30', '10:00', 'T-X1', 'pending', v_dock_a, 'outbound', 0);
    raise exception 'FAIL 1: overlapping insert on the same dock was accepted';
  exception when others then
    if sqlerrm not like '%dock_conflict%' then raise; end if;
  end;
  raise notice 'ok 1  insert overlap on same dock -> dock_conflict';

  -- 2. trigger: a queue that only touches the turnaround buffer is refused too (09:50 < 09:55)
  begin
    insert into public.bookings (company_id, shop_id, branch_id, service_id, customer_id, booking_date, start_time, end_time,
                                 queue_number, status, resource_id, direction, buffer_minutes)
    values (v_company, v_shop, v_branch, v_service, v_customer, c_date, '09:50', '10:20', 'T-X2', 'pending', v_dock_a, 'outbound', 0);
    raise exception 'FAIL 2: insert inside the buffer was accepted';
  exception when others then
    if sqlerrm not like '%dock_conflict%' then raise; end if;
  end;
  raise notice 'ok 2  insert inside buffer -> dock_conflict';

  -- 3. same time on a DIFFERENT dock is fine (the 2026-09-22 case), and so is back-to-back after the buffer
  insert into public.bookings (company_id, shop_id, branch_id, service_id, customer_id, booking_date, start_time, end_time,
                               queue_number, status, resource_id, direction, buffer_minutes)
  values (v_company, v_shop, v_branch, v_service, v_customer, c_date, '08:00', '10:00', 'T-B', 'pending', v_dock_b, 'outbound', 10)
  returning id into v_b;
  insert into public.bookings (company_id, shop_id, branch_id, service_id, customer_id, booking_date, start_time, end_time,
                               queue_number, status, resource_id, direction, buffer_minutes)
  values (v_company, v_shop, v_branch, v_service, v_customer, c_date, '09:55', '10:25', 'T-C', 'pending', v_dock_a, 'outbound', 0)
  returning id into v_c;
  raise notice 'ok 3  other dock / after buffer accepted';

  -- 4. approval of a clean pending queue still works and issues a DO
  select count(*) into v_rows from public.confirm_dock_booking(v_shop, v_b, null, null) r where r.do_number is not null;
  if v_rows <> 1 then raise exception 'FAIL 4: clean approval did not confirm'; end if;
  raise notice 'ok 4  clean approval confirmed';

  -- 5. trigger: moving a queue onto a busy dock / time is refused
  begin
    update public.bookings set resource_id = v_dock_a where id = v_b;
    raise exception 'FAIL 5: dock change onto a busy dock was accepted';
  exception when others then
    if sqlerrm not like '%dock_conflict%' then raise; end if;
  end;
  begin
    update public.bookings set start_time = '09:40', end_time = '10:10' where id = v_c;
    raise exception 'FAIL 5: time change into a busy window was accepted';
  exception when others then
    if sqlerrm not like '%dock_conflict%' then raise; end if;
  end;
  raise notice 'ok 5  move onto busy dock/time -> dock_conflict';

  -- 6. approval re-checks the dock: plant a legacy overlap with the guard off, then approve
  alter table public.bookings disable trigger bookings_dock_overlap_guard;
  insert into public.bookings (company_id, shop_id, branch_id, service_id, customer_id, booking_date, start_time, end_time,
                               queue_number, status, resource_id, direction, buffer_minutes, service_minutes)
  values (v_company, v_shop, v_branch, v_service, v_customer, c_date, '09:15', '09:45', 'T-D', 'pending', v_dock_a, 'outbound', 0, 30)
  returning id into v_d;
  alter table public.bookings enable trigger bookings_dock_overlap_guard;

  select coalesce(sum(dc.last_no), 0) into v_do_before from public.do_counters dc where dc.shop_id = v_shop;
  begin
    perform public.confirm_dock_booking(v_shop, v_d, null, null);
    raise exception 'FAIL 6: overlapping queue was approved';
  exception when others then
    if sqlerrm not like '%dock_conflict%' then raise; end if;
  end;
  begin
    perform public.confirm_dock_booking(v_shop, v_d, null, 30); -- what ApproveDialog sends: unchanged minutes
    raise exception 'FAIL 6: overlapping queue was approved (minutes pre-filled)';
  exception when others then
    if sqlerrm not like '%dock_conflict%' then raise; end if;
  end;
  select coalesce(sum(dc.last_no), 0) into v_do_after from public.do_counters dc where dc.shop_id = v_shop;
  if v_do_after <> v_do_before then raise exception 'FAIL 6: a refused approval burned a DO number'; end if;
  if (select status from public.bookings where id = v_d) <> 'pending' then raise exception 'FAIL 6: status changed'; end if;
  raise notice 'ok 6  approve overlapping pending -> dock_conflict, no DO burned';

  -- 7. plain status steps are never blocked, even while a legacy overlap exists
  update public.bookings set status = 'checked_in' where id = v_a;
  update public.bookings set status = 'called' where id = v_a;
  raise notice 'ok 7  status steps pass with a legacy overlap present';

  -- 8. closing the blocker frees the dock; reviving a closed queue into a busy window is refused
  update public.bookings set status = 'cancelled' where id = v_d;
  update public.bookings set status = 'completed' where id = v_a;
  update public.bookings set status = 'pending' where id = v_d;          -- A is closed now -> free
  begin
    update public.bookings set status = 'serving' where id = v_a;        -- D occupies 09:15–09:45 again
    raise exception 'FAIL 8: revived queue overlapped a live one';
  exception when others then
    if sqlerrm not like '%dock_conflict%' then raise; end if;
  end;
  raise notice 'ok 8  revive into busy window -> dock_conflict';

  raise notice 'ALL PASSED';
end;
$$;

rollback;
