-- SO and PO move to two portal pages with two menu keys, and two roles own the
-- keying: sales_admin (SO) and purchasing (PO). Warehouse staff keep seeing the
-- pages (payment recording), admin level keeps doing everything.
--
-- 1. Roles that listed the old 'documents' menu get both new menus instead.
-- 2. Seed the two keying roles as staff-level system roles (menu = own page only).

update public.roles
   set menu_keys = (
         select array_agg(k order by ord)
           from unnest(array_remove(menu_keys, 'documents') || array['sales_orders', 'purchase_orders']) with ordinality as u(k, ord)
       )
 where menu_keys is not null
   and 'documents' = any(menu_keys);

insert into public.roles (code, name, access_level, menu_keys, is_system, sort_order, description)
values
  ('sales_admin', 'แอดมินฝ่ายขาย', 'staff', array['sales_orders', 'notifications'], true, 2, 'คีย์ใบสั่งขาย (SO) และส่งลิงก์จองให้ลูกค้า'),
  ('purchasing',  'ฝ่ายจัดซื้อ',     'staff', array['purchase_orders', 'notifications'], true, 3, 'คีย์ใบสั่งซื้อ (PO) และส่งลิงก์จองให้ Supplier')
on conflict (code) do update
   set is_deleted = false,
       access_level = 'staff',
       is_system = true,
       name = excluded.name,
       description = coalesce(public.roles.description, excluded.description);
