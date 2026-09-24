-- ============================================================
-- Smoke test for 202609250001_unpaid_auto_cancel.sql
--
--   psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -f supabase/tests/unpaid_auto_cancel.sql
--
-- Runs inside one transaction and ROLLS BACK: nothing is kept. Needs a
-- seeded site (1 shop, 1 branch, 1 vehicle type, 1 customer). Works on a
-- far-future date so it never collides with real queues. Any failed check
-- raises and stops the script; the last line printed must be "ALL PASSED".
-- ============================================================
begin;

do $$
declare
  c_date constant date := date '2099-02-03';
  v_company uuid; v_shop uuid; v_branch uuid; v_service uuid; v_customer uuid;
  v_so_unpaid uuid; v_so_paid uuid; v_po uuid;
  v_q_unpaid uuid; v_q_paid uuid; v_q_admin uuid; v_q_po uuid;
  v_status text; v_reason text; v_ok boolean;
begin
  select s.company_id, s.id into v_company, v_shop from public.shops s order by s.created_at limit 1;
  select b.id into v_branch from public.branches b where b.shop_id = v_shop and not b.is_deleted order by b.created_at limit 1;
  select sv.id into v_service from public.services sv where sv.shop_id = v_shop and not sv.is_deleted order by sv.created_at limit 1;
  select c.id into v_customer from public.customers c where c.shop_id = v_shop and not c.is_deleted order by c.created_at limit 1;
  if v_shop is null or v_branch is null or v_service is null then
    raise exception 'seed data missing (need shop, branch, vehicle type)';
  end if;
  -- A fresh chain has no partners yet; one throwaway customer is enough (rolled back with the rest).
  if v_customer is null then
    insert into public.customers (company_id, shop_id, partner_type, full_name, code)
    values (v_company, v_shop, 'customer', 'ทดสอบ ยกเลิกอัตโนมัติ', 'TEST-UNPAID') returning id into v_customer;
  end if;

  -- Three documents: unpaid SO, paid SO, PO (never gated).
  insert into public.external_documents (company_id, shop_id, branch_id, doc_type, doc_no, partner_id, partner_name, status, source, payment_status)
  values (v_company, v_shop, v_branch, 'so', 'SO-TEST-UNPAID-CANCEL', v_customer, 'ทดสอบ', 'open', 'manual', 'unpaid') returning id into v_so_unpaid;
  insert into public.external_documents (company_id, shop_id, branch_id, doc_type, doc_no, partner_id, partner_name, status, source, payment_status)
  values (v_company, v_shop, v_branch, 'so', 'SO-TEST-PAID-CANCEL', v_customer, 'ทดสอบ', 'open', 'manual', 'paid') returning id into v_so_paid;
  insert into public.external_documents (company_id, shop_id, branch_id, doc_type, doc_no, partner_id, partner_name, status, source, payment_status)
  values (v_company, v_shop, v_branch, 'po', 'PO-TEST-CANCEL', v_customer, 'ทดสอบ', 'open', 'manual', 'unpaid') returning id into v_po;

  -- Pending queues straight into the table (no dock needed: pending holds no dock).
  insert into public.bookings (company_id, shop_id, branch_id, direction, document_id, service_id, customer_id, booking_date, start_time, end_time, status, booking_source, queue_number, plate_number)
  values (v_company, v_shop, v_branch, 'outbound', v_so_unpaid, v_service, v_customer, c_date, '09:00', '09:30', 'pending', 'customer_link', 'R-901', 'TEST901') returning id into v_q_unpaid;
  insert into public.bookings (company_id, shop_id, branch_id, direction, document_id, service_id, customer_id, booking_date, start_time, end_time, status, booking_source, queue_number, plate_number)
  values (v_company, v_shop, v_branch, 'outbound', v_so_paid, v_service, v_customer, c_date, '10:00', '10:30', 'pending', 'customer_link', 'R-902', 'TEST902') returning id into v_q_paid;
  insert into public.bookings (company_id, shop_id, branch_id, direction, document_id, service_id, customer_id, booking_date, start_time, end_time, status, booking_source, queue_number, plate_number)
  values (v_company, v_shop, v_branch, 'outbound', v_so_unpaid, v_service, v_customer, c_date, '11:00', '11:30', 'pending', 'admin', 'R-903', 'TEST903') returning id into v_q_admin;
  insert into public.bookings (company_id, shop_id, branch_id, direction, document_id, service_id, customer_id, booking_date, start_time, end_time, status, booking_source, queue_number, plate_number)
  values (v_company, v_shop, v_branch, 'inbound', v_po, v_service, v_customer, c_date, '12:00', '12:30', 'pending', 'customer_link', 'S-904', 'TEST904') returning id into v_q_po;

  -- 1. Paid SO: nothing happens.
  select public.cancel_unpaid_booking(v_shop, v_q_paid, 'x') into v_ok;
  select status into v_status from public.bookings where id = v_q_paid;
  if v_ok or v_status <> 'pending' then raise exception 'check 1 failed: paid SO queue touched (% / %)', v_ok, v_status; end if;

  -- 2. Staff-made queue on the unpaid SO: left alone.
  select public.cancel_unpaid_booking(v_shop, v_q_admin, 'x') into v_ok;
  select status into v_status from public.bookings where id = v_q_admin;
  if v_ok or v_status <> 'pending' then raise exception 'check 2 failed: admin queue touched'; end if;

  -- 3. PO: never gated.
  select public.cancel_unpaid_booking(v_shop, v_q_po, 'x') into v_ok;
  select status into v_status from public.bookings where id = v_q_po;
  if v_ok or v_status <> 'pending' then raise exception 'check 3 failed: PO queue touched'; end if;

  -- 4. Wrong shop id: refused.
  select public.cancel_unpaid_booking(gen_random_uuid(), v_q_unpaid, 'x') into v_ok;
  if v_ok then raise exception 'check 4 failed: cancelled across shops'; end if;

  -- 5. Unpaid customer-link queue: cancelled with the reason, cancelled_by null.
  select public.cancel_unpaid_booking(v_shop, v_q_unpaid, 'ไม่ได้ชำระเงินภายในเวลาที่กำหนด — ระบบยกเลิกอัตโนมัติ') into v_ok;
  select status, cancel_reason into v_status, v_reason from public.bookings where id = v_q_unpaid;
  if not v_ok or v_status <> 'cancelled' or v_reason not like 'ไม่ได้ชำระเงิน%' then raise exception 'check 5 failed: % / % / %', v_ok, v_status, v_reason; end if;

  -- 6. Second call on the same queue: no-op.
  select public.cancel_unpaid_booking(v_shop, v_q_unpaid, 'x') into v_ok;
  if v_ok then raise exception 'check 6 failed: cancelled twice'; end if;

  -- 7. Payment recorded before the sweep reaches the queue: kept.
  insert into public.bookings (company_id, shop_id, branch_id, direction, document_id, service_id, customer_id, booking_date, start_time, end_time, status, booking_source, queue_number, plate_number)
  values (v_company, v_shop, v_branch, 'outbound', v_so_unpaid, v_service, v_customer, c_date, '13:00', '13:30', 'pending', 'customer_link', 'R-905', 'TEST905') returning id into v_q_unpaid;
  update public.external_documents set payment_status = 'paid', payment_updated_at = now() where id = v_so_unpaid;
  select public.cancel_unpaid_booking(v_shop, v_q_unpaid, 'x') into v_ok;
  select status into v_status from public.bookings where id = v_q_unpaid;
  if v_ok or v_status <> 'pending' then raise exception 'check 7 failed: paid-in-the-meantime queue cancelled'; end if;

  raise notice 'ALL PASSED';
end $$;

rollback;
