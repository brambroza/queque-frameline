-- Audit trail hardening + indexes for the portal "ประวัติการใช้งาน" page.
--
-- Before: `p_activity_logs_rw` was `for all` to every member of the shop, so any
-- logged-in user could edit or delete audit rows straight from the browser client.
-- After: session clients may only READ, and only at admin level. Rows are written
-- by the service role (`writeAuditLog`), which bypasses RLS — no write policy exists
-- on purpose.
--
-- Safe to skip: without this migration the log page still works (old policy allows
-- the read); the trail is just not tamper-proof yet.

alter table public.activity_logs enable row level security;

drop policy if exists p_activity_logs_rw on public.activity_logs;
drop policy if exists p_activity_logs_read on public.activity_logs;

create policy p_activity_logs_read on public.activity_logs
for select using (
  public.can_access_shop(shop_id) and public.has_access_level('admin')
);

-- The page lists newest first and filters by table / user / action inside one shop.
create index if not exists activity_logs_shop_created_idx
  on public.activity_logs (shop_id, created_at desc);

create index if not exists activity_logs_shop_table_idx
  on public.activity_logs (shop_id, target_table, created_at desc);

create index if not exists activity_logs_shop_user_idx
  on public.activity_logs (shop_id, user_id, created_at desc);

create index if not exists activity_logs_target_idx
  on public.activity_logs (target_id)
  where target_id is not null;
