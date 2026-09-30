/*
 * Four access levels instead of two, and the roles Fameline asked for.
 *
 *   admin    runs the site (unchanged)
 *   manager  warehouse manager: everything staff does + reports and the
 *            warehouse set-up (docks, vehicle types, working hours, holidays,
 *            partners, queue settings). No staff / role / branch / LINE / ERP screens.
 *   staff    gate and dock work (unchanged)
 *   viewer   read-only: opens the pages it is given and can change nothing
 *
 * The API tier is enforced in the route guards (src/lib/auth/levels.ts). This
 * file adds the second layer for `viewer`: restrictive RLS policies that refuse
 * every insert / update / delete made with a viewer's own session, so reading
 * the anon key out of the browser does not turn a read-only account into a
 * writing one. Service-role writes (public token routes, cron, audit log) are
 * not affected.
 *
 * Seeded roles: wh_admin (staff), wh_manager (manager), director (viewer).
 * sales_admin, purchasing, staff and admin stay as they are.
 */

-- ---------------------------------------------------------------------------
-- 1. Levels
-- ---------------------------------------------------------------------------
alter table public.roles drop constraint if exists roles_access_level_check;
alter table public.roles
  add constraint roles_access_level_check check (access_level in ('admin', 'manager', 'staff', 'viewer'));

comment on column public.roles.access_level is 'API tier the role grants: admin | manager | staff | viewer. Route guards check this, not the role code.';

-- ---------------------------------------------------------------------------
-- 2. Roles. An existing row with the same code keeps its menus (the admin may
--    have tuned them); its level and name follow this file.
-- ---------------------------------------------------------------------------
insert into public.roles (code, name, access_level, menu_keys, is_system, sort_order, description)
values
  ('wh_admin', 'แอดมินคลัง', 'staff',
   array['dock_queues', 'sales_orders', 'purchase_orders', 'calendar', 'queue_board', 'queue_display', 'notifications'],
   true, 4, 'งานหน้าคลัง: สร้างคิว เช็คอิน เรียกคิว อนุมัติ บันทึกการชำระเงิน'),
  ('wh_manager', 'ผู้จัดการคลัง', 'manager',
   array['dashboard', 'dock_queues', 'sales_orders', 'purchase_orders', 'calendar', 'queue_board', 'queue_display', 'notifications',
         'vehicle_types', 'docks', 'working_hours', 'holidays', 'partners', 'reports', 'site_settings'],
   true, 5, 'ทุกอย่างของแอดมินคลัง + รายงาน และตั้งค่าคลัง (ท่า ประเภทรถ เวลาทำการ วันหยุด คู่ค้า ตั้งค่าคิว)'),
  ('director', 'ผู้บริหาร', 'viewer',
   array['dashboard', 'calendar', 'queue_board', 'reports'],
   true, 6, 'ดูอย่างเดียว: แดชบอร์ด ปฏิทิน บอร์ดคิว รายงาน — แก้ไขข้อมูลไม่ได้')
on conflict (code) do update
   set is_deleted = false,
       access_level = excluded.access_level,
       is_system = true,
       name = excluded.name,
       description = coalesce(public.roles.description, excluded.description);

-- ---------------------------------------------------------------------------
-- 3. Read-only callers. Security definer: it is called from policies on tables
--    it would otherwise have to read through those same policies.
-- ---------------------------------------------------------------------------

/*
 * True when the caller holds at least one live role and every live role they
 * hold is viewer-level. A viewer role next to a working role does not make the
 * user read-only; no role at all is left to the shop-level policies.
 */
create or replace function public.is_view_only()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    exists (
      select 1
      from public.user_roles ur
      join public.roles r on r.id = ur.role_id
      where ur.user_id = auth.uid()
        and ur.is_deleted = false
        and r.is_deleted = false
    )
    and not exists (
      select 1
      from public.user_roles ur
      join public.roles r on r.id = ur.role_id
      where ur.user_id = auth.uid()
        and ur.is_deleted = false
        and r.is_deleted = false
        and r.access_level <> 'viewer'
    );
$$;

revoke all on function public.is_view_only() from public;
grant execute on function public.is_view_only() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4. Restrictive write policies (ANDed with each table's permissive policy).
--    Same guard as the branch policies: a table is only touched when it has
--    RLS enabled and a permissive policy, otherwise a restrictive policy alone
--    would deny everything.
--
--    Left writable on purpose: users_profile (a viewer edits their own name and
--    phone) and feedback_reports (the "report a problem" button).
--
--    A table created later is not covered until it is added here or given the
--    same three policies.
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  for t in
    select c.relname
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and c.relkind = 'r'
       and c.relrowsecurity
       and c.relname not in ('users_profile', 'feedback_reports')
       and exists (select 1 from pg_policy p where p.polrelid = c.oid and p.polpermissive)
     order by c.relname
  loop
    execute format('drop policy if exists p_%s_viewer_insert on public.%I;', t, t);
    execute format('drop policy if exists p_%s_viewer_update on public.%I;', t, t);
    execute format('drop policy if exists p_%s_viewer_delete on public.%I;', t, t);
    execute format('create policy p_%s_viewer_insert on public.%I as restrictive for insert with check (not public.is_view_only());', t, t);
    execute format('create policy p_%s_viewer_update on public.%I as restrictive for update using (not public.is_view_only()) with check (not public.is_view_only());', t, t);
    execute format('create policy p_%s_viewer_delete on public.%I as restrictive for delete using (not public.is_view_only());', t, t);
  end loop;
end $$;
