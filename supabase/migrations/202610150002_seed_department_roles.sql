-- Department roles as the customer names them (2026-10-15).
--
-- Four roles, one per department, ready to pick on /portal/staff:
--
--   ฝ่ายขาย     sales_admin  staff   SO page (key, send booking link, walk-in, close/cancel) + customers tab of partners + notifications
--   ฝ่ายจัดซื้อ  purchasing   staff   PO page (same buttons for suppliers) + suppliers tab of partners + notifications
--   ทีมคลัง     wh_admin     staff   queues, queue board, calendar, SO/PO (payment + approve), display links
--   ผู้บริหาร    director     viewer  dashboard, calendar, queue board, reports — read-only
--
-- The first three are working roles: every action button of their pages is
-- enabled (staff tier; the SO/PO write check is by role code, see
-- src/lib/auth/document-access.ts). Only ผู้บริหาร is read-only (viewer tier,
-- enforced by is_view_only() in RLS and by the API guards).
--
-- Same codes as the earlier seeds (202609250002, 202609300002) so existing
-- grants keep working; this file sets the display names from the customer's
-- list and pins the menus of each role. Requires 202609300002 (viewer level).

insert into public.roles (code, name, access_level, menu_keys, is_system, sort_order, description, branch_ids, can_export, multi_branch)
values
  ('sales_admin', 'ฝ่ายขาย', 'staff',
   array['sales_orders', 'partners', 'notifications'],
   true, 1, 'คีย์ใบสั่งขาย (SO) ส่งลิงก์จองให้ลูกค้า สร้างคิว walk-in ปิด/ยกเลิก SO เพิ่ม/แก้ลูกค้า', null, true, true),
  ('purchasing', 'ฝ่ายจัดซื้อ', 'staff',
   array['purchase_orders', 'partners', 'notifications'],
   true, 2, 'คีย์ใบสั่งซื้อ (PO) ส่งลิงก์จองให้ Supplier สร้างคิว walk-in ปิด/ยกเลิก PO เพิ่ม/แก้ Supplier', null, true, true),
  ('wh_admin', 'ทีมคลัง', 'staff',
   array['dock_queues', 'sales_orders', 'purchase_orders', 'calendar', 'queue_board', 'queue_display', 'notifications'],
   true, 3, 'งานหน้าคลัง: สร้างคิว อนุมัติ เช็คอิน เรียกคิว ปิดงาน บันทึกการชำระเงิน', null, true, true),
  ('director', 'ผู้บริหาร', 'viewer',
   array['dashboard', 'calendar', 'queue_board', 'reports'],
   true, 4, 'ดูอย่างเดียว: แดชบอร์ด ปฏิทิน บอร์ดคิว รายงาน — กดปุ่มแก้ไขข้อมูลไม่ได้', null, true, true)
on conflict (code) do update
   set is_deleted = false,
       name = excluded.name,
       access_level = excluded.access_level,
       menu_keys = excluded.menu_keys,
       is_system = true,
       sort_order = excluded.sort_order,
       description = excluded.description,
       updated_at = now();

-- Working roles must not sit behind a stale "no branch" limit from an earlier
-- experiment; branch limits are set per staff member (202610150001) or per role
-- on /portal/staff afterwards.
update public.roles
   set branch_ids = null
 where code in ('sales_admin', 'purchasing', 'wh_admin', 'director')
   and branch_ids is not null
   and cardinality(branch_ids) = 0;
