-- Fameline seed: the single site, its settings and a starter configuration.
-- Fixed UUIDs so the file can be re-run safely (idempotent upserts).
--
-- After applying: node scripts/create-admin.mjs <email> <password> "ชื่อ" admin

insert into public.companies (id, name, created_at, updated_at)
values ('10000000-0000-4000-8000-000000000001', 'Fameline', now(), now())
on conflict (id) do update set name = excluded.name;

insert into public.shops (id, company_id, name, shop_key, default_language)
values ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Fameline Warehouse', 'fameline', 'th')
on conflict (id) do update set name = excluded.name, shop_key = excluded.shop_key;

insert into public.branches (id, company_id, shop_id, branch_name, open_time, close_time, max_parallel_queues, active)
values ('30000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'คลังสินค้าหลัก', '08:00', '17:00', 3, true)
on conflict (id) do update set branch_name = excluded.branch_name;

insert into public.site_settings (shop_id, company_id)
values ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001')
on conflict (shop_id) do nothing;

-- Vehicle types (services). duration = time at the dock, buffer = turnaround after.
insert into public.services (id, company_id, shop_id, service_name, duration_minutes, buffer_minutes, capacity_per_slot, price, active, sort_order, direction)
values
  ('40000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'รถกระบะ / 4 ล้อ', 30, 0, 1, 0, true, 1, null),
  ('40000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'รถ 6 ล้อ', 45, 10, 1, 0, true, 2, null),
  ('40000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'รถ 10 ล้อ', 60, 10, 1, 0, true, 3, null),
  ('40000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'รถเทรลเลอร์ / ตู้คอนเทนเนอร์', 90, 15, 1, 0, true, 4, null)
on conflict (id) do update
  set service_name = excluded.service_name,
      duration_minutes = excluded.duration_minutes,
      buffer_minutes = excluded.buffer_minutes,
      sort_order = excluded.sort_order;

-- Docks (booking_resources). D1 outbound only, D2 inbound only, D3 shared.
insert into public.booking_resources (id, company_id, shop_id, branch_id, resource_type, resource_code, resource_name, capacity, active, direction)
values
  ('50000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', 'dock', 'D1', 'ท่า 1 (รับสินค้า)', 1, true, 'outbound'),
  ('50000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', 'dock', 'D2', 'ท่า 2 (ส่งสินค้า)', 1, true, 'inbound'),
  ('50000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', 'dock', 'D3', 'ท่า 3 (รับ/ส่ง)', 1, true, null)
on conflict (id) do update
  set resource_name = excluded.resource_name,
      resource_code = excluded.resource_code,
      direction = excluded.direction;

-- Working hours Mon-Fri 08:00-17:00, lunch 12:00-13:00, 30-minute grid, both directions.
insert into public.working_hours (id, company_id, shop_id, branch_id, weekday, open_time, close_time, break_start, break_end, slot_interval_minutes, capacity_per_slot, active)
select
  ('60000000-0000-4000-8000-00000000000' || d)::uuid,
  '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000001',
  d, '08:00', '17:00', '12:00', '13:00', 30, 3, true
from generate_series(1, 5) as d
on conflict (id) do nothing;
