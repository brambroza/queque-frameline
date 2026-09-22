-- ============================================================
-- Multi-branch smoke test for the dock overlap guard
-- (202609210002_dock_overlap_guard.sql), driven through the real RPCs.
--
--   psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -f supabase/tests/dock_overlap_multibranch.sql
--
-- Runs inside one transaction and ROLLS BACK: the second branch, its docks,
-- its working hours and every queue created here disappear, and no DO number
-- is kept. Needs a seeded site (1 shop, 1 branch with docks + working hours,
-- 1 vehicle type). The last line printed must be "ALL PASSED".
-- ============================================================
begin;

do $$
declare
  v_company uuid; v_shop uuid; v_hq uuid; v_b2 uuid; v_service uuid; v_customer uuid;
  v_b2_dock1 uuid; v_b2_dock2 uuid;
  v_date date; v_slot time; v_next time;
  v_cap_hq int; v_cap_b2 int; v_n int;
  v_id uuid; v_dock uuid; v_legacy uuid; v_hq_queue uuid;
  r record;
begin
  select s.company_id, s.id into v_company, v_shop from public.shops s order by s.created_at limit 1;
  select b.id into v_hq from public.branches b where b.shop_id = v_shop and not b.is_deleted order by b.created_at limit 1;
  select sv.id into v_service from public.services sv
   where sv.shop_id = v_shop and not sv.is_deleted and (sv.direction is null or sv.direction = 'outbound')
   order by sv.sort_order, sv.created_at limit 1;
  select c.id into v_customer from public.customers c where c.shop_id = v_shop order by c.created_at limit 1;
  if v_shop is null or v_hq is null or v_service is null then
    raise exception 'seed data missing (need shop, branch, vehicle type)';
  end if;
  if v_customer is null then
    insert into public.customers (company_id, shop_id) values (v_company, v_shop) returning id into v_customer;
  end if;

  -- ---------------------------------------------------------------------------
  -- Second branch: 2 docks (one outbound-only, one shared) + the same hours as the first
  -- ---------------------------------------------------------------------------
  insert into public.branches (company_id, shop_id, code, branch_name, open_time, close_time)
  values (v_company, v_shop, 'T2', 'สาขาทดสอบ 2', '08:00', '17:00') returning id into v_b2;
  insert into public.booking_resources (company_id, shop_id, branch_id, resource_type, resource_code, resource_name, direction)
  values (v_company, v_shop, v_b2, 'dock', 'T2-D1', 'สาขา 2 ท่า 1', 'outbound') returning id into v_b2_dock1;
  insert into public.booking_resources (company_id, shop_id, branch_id, resource_type, resource_code, resource_name, direction)
  values (v_company, v_shop, v_b2, 'dock', 'T2-D2', 'สาขา 2 ท่า 2', null) returning id into v_b2_dock2;
  insert into public.working_hours (company_id, shop_id, branch_id, weekday, open_time, close_time, break_start, break_end,
                                    slot_interval_minutes, capacity_per_slot, active, direction)
  select w.company_id, w.shop_id, v_b2, w.weekday, w.open_time, w.close_time, w.break_start, w.break_end,
         w.slot_interval_minutes, w.capacity_per_slot, w.active, w.direction
  from public.working_hours w where w.shop_id = v_shop and w.branch_id = v_hq and not w.is_deleted;

  select count(*) into v_cap_hq from public.eligible_docks(v_shop, v_hq, 'outbound', v_service);
  select count(*) into v_cap_b2 from public.eligible_docks(v_shop, v_b2, 'outbound', v_service);
  if v_cap_b2 <> 2 then raise exception 'FAIL setup: branch 2 should have 2 eligible docks, got %', v_cap_b2; end if;
  if v_cap_hq < 1 then raise exception 'FAIL setup: first branch has no eligible dock'; end if;

  -- a working day far enough ahead that nobody has booked it
  select d::date into v_date
  from generate_series(current_date + 30, current_date + 60, interval '1 day') d
  where not exists (select 1 from public.bookings k where k.shop_id = v_shop and k.booking_date = d::date and not k.is_deleted)
    and exists (select 1 from public.get_dock_slots(v_shop, v_hq, 'outbound', v_service, d::date) s where s.remaining_capacity > 0)
    and exists (select 1 from public.get_dock_slots(v_shop, v_b2, 'outbound', v_service, d::date) s where s.remaining_capacity > 0)
  limit 1;
  if v_date is null then raise exception 'FAIL setup: no free working day found'; end if;
  select s.slot_time into v_slot from public.get_dock_slots(v_shop, v_hq, 'outbound', v_service, v_date) s
   where s.remaining_capacity > 0 order by s.slot_time limit 1;
  raise notice 'setup  date % slot %  docks: first branch %, branch 2 %', v_date, v_slot, v_cap_hq, v_cap_b2;

  -- ---------------------------------------------------------------------------
  -- 1. Fill the slot in the first branch: one queue per dock, then "full"
  -- ---------------------------------------------------------------------------
  for v_n in 1 .. v_cap_hq loop
    perform public.create_dock_booking(v_shop, v_hq, 'outbound', v_service, v_date, v_slot, v_customer, 'ทดสอบ-HQ', 'pending', 'admin');
  end loop;
  begin
    perform public.create_dock_booking(v_shop, v_hq, 'outbound', v_service, v_date, v_slot, v_customer, 'ทดสอบ-HQ', 'pending', 'admin');
    raise exception 'FAIL 1: first branch accepted more queues than docks';
  exception when others then
    if sqlerrm not like '%slot_unavailable%' then raise; end if;
  end;
  if (select count(distinct k.resource_id) from public.bookings k where k.booking_date = v_date and k.branch_id = v_hq) <> v_cap_hq then
    raise exception 'FAIL 1: two queues of the first branch share a dock';
  end if;
  raise notice 'ok 1  first branch: % queues on % docks, next one -> slot_unavailable', v_cap_hq, v_cap_hq;

  -- ---------------------------------------------------------------------------
  -- 2. The same slot in branch 2 is still open: capacity is per branch, and the
  --    queues land on branch 2 docks only
  -- ---------------------------------------------------------------------------
  for v_n in 1 .. v_cap_b2 loop
    select c.resource_id into v_dock
    from public.create_dock_booking(v_shop, v_b2, 'outbound', v_service, v_date, v_slot, v_customer, 'ทดสอบ-B2', 'pending', 'admin') c;
    if v_dock not in (v_b2_dock1, v_b2_dock2) then raise exception 'FAIL 2: branch 2 queue was put on a dock of another branch'; end if;
  end loop;
  begin
    perform public.create_dock_booking(v_shop, v_b2, 'outbound', v_service, v_date, v_slot, v_customer, 'ทดสอบ-B2', 'pending', 'admin');
    raise exception 'FAIL 2: branch 2 accepted more queues than docks';
  exception when others then
    if sqlerrm not like '%slot_unavailable%' then raise; end if;
  end;
  if exists (select 1 from public.bookings k join public.booking_resources d on d.id = k.resource_id
             where k.booking_date = v_date and d.branch_id is distinct from k.branch_id) then
    raise exception 'FAIL 2: a queue sits on a dock of a different branch';
  end if;
  raise notice 'ok 2  branch 2: same slot still open while the first branch is full, docks stay inside the branch';

  -- ---------------------------------------------------------------------------
  -- 3. Approve everything in both branches: same time, different docks -> all pass
  -- ---------------------------------------------------------------------------
  for r in select k.id from public.bookings k where k.booking_date = v_date and k.status = 'pending' loop
    if not exists (select 1 from public.confirm_dock_booking(v_shop, r.id, null, null)) then
      raise exception 'FAIL 3: approval returned nothing';
    end if;
  end loop;
  if (select count(*) from public.bookings k where k.booking_date = v_date and k.status = 'confirmed') <> v_cap_hq + v_cap_b2 then
    raise exception 'FAIL 3: not every queue was approved';
  end if;
  if (select count(*) - count(distinct k.do_number) from public.bookings k where k.booking_date = v_date) <> 0 then
    raise exception 'FAIL 3: duplicate DO number across branches';
  end if;
  raise notice 'ok 3  approved % queues at the same time across 2 branches, DO numbers unique', v_cap_hq + v_cap_b2;

  -- ---------------------------------------------------------------------------
  -- 4. Approving a queue that overlaps on a branch 2 dock is refused; the other
  --    branch is not affected by it
  -- ---------------------------------------------------------------------------
  alter table public.bookings disable trigger bookings_dock_overlap_guard;
  insert into public.bookings (company_id, shop_id, branch_id, service_id, customer_id, booking_date, start_time, end_time,
                               queue_number, status, resource_id, direction, buffer_minutes, service_minutes)
  values (v_company, v_shop, v_b2, v_service, v_customer, v_date, v_slot + interval '10 minutes', v_slot + interval '40 minutes',
          'T-LEGACY', 'pending', v_b2_dock1, 'outbound', 0, 30)
  returning id into v_legacy;
  alter table public.bookings enable trigger bookings_dock_overlap_guard;
  begin
    perform public.confirm_dock_booking(v_shop, v_legacy, null, 30);
    raise exception 'FAIL 4: overlapping queue on a branch 2 dock was approved';
  exception when others then
    if sqlerrm not like '%dock_conflict%' then raise; end if;
  end;
  raise notice 'ok 4  branch 2: approve overlapping queue -> dock_conflict';

  -- ---------------------------------------------------------------------------
  -- 5. Writing a first-branch queue onto a busy dock of branch 2 is refused
  --    (the guard follows the dock, not the branch)
  -- ---------------------------------------------------------------------------
  select k.id into v_hq_queue from public.bookings k where k.booking_date = v_date and k.branch_id = v_hq limit 1;
  begin
    update public.bookings set resource_id = v_b2_dock2 where id = v_hq_queue;
    raise exception 'FAIL 5: queue was moved onto a busy dock of another branch';
  exception when others then
    if sqlerrm not like '%dock_conflict%' then raise; end if;
  end;
  raise notice 'ok 5  cross-branch write onto a busy dock -> dock_conflict';

  -- ---------------------------------------------------------------------------
  -- 6. Reschedule inside branch 2 still works and stays on a branch 2 dock;
  --    cancelling frees the dock for a new queue in that branch only
  -- ---------------------------------------------------------------------------
  update public.bookings set status = 'cancelled' where id = v_legacy;
  select k.id into v_id from public.bookings k where k.booking_date = v_date and k.branch_id = v_b2 and k.status = 'confirmed' limit 1;
  select s.slot_time into v_next from public.get_dock_slots(v_shop, v_b2, 'outbound', v_service, v_date, null, v_id) s
   where s.remaining_capacity > 0 and s.slot_time > v_slot order by s.slot_time limit 1;
  perform public.move_dock_booking(v_shop, v_id, v_date, v_next);
  if (select d.branch_id from public.bookings k join public.booking_resources d on d.id = k.resource_id where k.id = v_id) <> v_b2 then
    raise exception 'FAIL 6: rescheduled queue left its branch';
  end if;
  raise notice 'ok 6  branch 2: reschedule % -> % stays in the branch', v_slot, v_next;

  -- ---------------------------------------------------------------------------
  -- 7. Final sweep: no two live queues overlap on any dock of the test day
  -- ---------------------------------------------------------------------------
  if exists (
    select 1 from public.bookings a join public.bookings b
      on a.resource_id = b.resource_id and a.booking_date = b.booking_date and a.id < b.id
     and a.start_time < public.booking_block_end(b.booking_date, b.start_time, b.end_time, b.buffer_minutes)
     and b.start_time < public.booking_block_end(a.booking_date, a.start_time, a.end_time, a.buffer_minutes)
    where a.booking_date = v_date and not a.is_deleted and not b.is_deleted
      and a.status not in ('cancelled', 'no_show', 'skipped', 'completed')
      and b.status not in ('cancelled', 'no_show', 'skipped', 'completed')
      and a.id <> v_legacy and b.id <> v_legacy
  ) then
    raise exception 'FAIL 7: overlapping live queues found on a dock';
  end if;
  raise notice 'ok 7  no overlapping live queues on any dock, both branches';

  raise notice 'ALL PASSED';
end;
$$;

rollback;
