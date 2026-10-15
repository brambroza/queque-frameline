-- Per-menu "แก้ไขได้" switch on roles (2026-10-15).
--
-- /portal/staff → "สิทธิ์และเมนู" now has two columns per menu: เห็น (menu_keys)
-- and แก้ไขได้ (write_keys). The write list decides which pages show their
-- action buttons (add / edit / delete / status) and which write routes accept
-- the caller — before this, buttons followed the level plus two hard-coded
-- role codes (sales_admin → SO, purchasing → PO), so a custom role could see
-- the SO page but never key an SO.
--
--   roles.write_keys  null  = the level's defaults (what applied before this file;
--                             src/lib/auth/menu-registry.ts legacyWriteKeys)
--                     {...} = only these menus, clamped to the menus the role
--                             sees and to what its level may write
--   admin-level roles write everywhere they see; viewer-level roles nowhere.
--
-- Enforced in the API layer (assertWriteMenu / assertWriteAny); RLS keeps
-- guarding the level (is_view_only) and the branch, not the per-menu switch.

alter table public.roles
  add column if not exists write_keys text[];

comment on column public.roles.write_keys is 'Menus whose write actions members may use ("แก้ไขได้"). Null = the level''s defaults. Ignored for admin (all) and viewer (none) roles.';

-- Seed the department roles with an explicit list so what the admin sees on
-- the role screen is exactly what applies. Other roles keep null (defaults).
update public.roles set write_keys = array['sales_orders', 'partners']     where code = 'sales_admin' and write_keys is null;
update public.roles set write_keys = array['purchase_orders', 'partners']  where code = 'purchasing'  and write_keys is null;
update public.roles set write_keys = array['dock_queues', 'queue_board']    where code = 'wh_admin'    and write_keys is null;
update public.roles set write_keys = array['dock_queues', 'queue_board', 'partners', 'vehicle_types', 'docks', 'working_hours', 'holidays', 'site_settings']
  where code = 'wh_manager' and write_keys is null;
update public.roles set write_keys = '{}'::text[] where code = 'director' and write_keys is null;
