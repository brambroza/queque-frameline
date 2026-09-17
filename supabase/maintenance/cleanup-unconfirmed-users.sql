-- ============================================================================
-- Cleanup: auth users who never confirmed their email
-- ============================================================================
-- Manual maintenance script for the Supabase SQL Editor. NOT a migration.
--
-- Part 1  CHECK  : read-only report. Run it first and read the `action` column.
-- Part 2  DELETE : transaction that removes the rows Part 1 marked
--                  delete_tenant / delete_user_only. Ends with ROLLBACK by
--                  default; change the last line to COMMIT once you are happy.
--
-- Tunable: MIN_AGE_DAYS = 7  (appears twice, search for ">= 7")
--   Signups younger than this are kept so a real person still has time to
--   click the confirmation link.
--
-- Rules (same as scripts/cleanup-unconfirmed-users.mjs):
--   * Unconfirmed = email_confirmed_at, confirmed_at, phone_confirmed_at all
--     NULL and the user has never signed in.
--   * super_admin users are never touched.
--   * delete_tenant      : user is the ONLY member of their company and the
--                          shop has no bookings -> remove the whole tenant
--                          created by /api/auth/register.
--   * delete_user_only   : company has other members (or no tenant at all)
--                          -> remove only the user's own rows + auth user.
--   * skip (has bookings): shop already received bookings; review by hand.
--
-- The public schema has no ON DELETE CASCADE, so Part 2 deletes children
-- before parents. Tables from migrations that may not be applied yet are
-- guarded with to_regclass().
-- ============================================================================


-- ============================================================================
-- PART 1 — CHECK (read-only)
-- ============================================================================
with candidates as (
  select
    u.id                                                        as user_id,
    u.email,
    u.created_at,
    extract(day from now() - u.created_at)::int                 as age_days,
    up.company_id,
    up.shop_id,
    s.name                                                      as shop_name,
    exists (
      select 1
      from public.user_roles ur
      join public.roles r on r.id = ur.role_id
      where ur.user_id = u.id and r.code = 'super_admin'
    )                                                           as is_super_admin,
    (
      (select count(*) from public.users_profile x where x.company_id = up.company_id and x.id      <> u.id)
    + (select count(*) from public.user_roles    x where x.company_id = up.company_id and x.user_id <> u.id)
    + (select count(*) from public.staff         x where x.company_id = up.company_id and x.user_id <> u.id)
    )                                                           as other_members,
    (select count(*) from public.bookings b where b.company_id = up.company_id) as bookings
  from auth.users u
  left join public.users_profile up on up.id = u.id
  left join public.shops         s  on s.id  = up.shop_id
  where u.email_confirmed_at is null
    and u.confirmed_at       is null
    and u.phone_confirmed_at is null
    and u.last_sign_in_at    is null
)
select
  email,
  created_at::date                        as created,
  age_days,
  coalesce(shop_name, '-')                as shop,
  other_members,
  bookings,
  case
    when is_super_admin         then 'skip (super_admin)'
    when age_days < 7           then 'skip (too new)'          -- MIN_AGE_DAYS
    when company_id is null     then 'delete_user_only'
    when other_members > 0      then 'delete_user_only (tenant kept)'
    when bookings > 0           then 'skip (has bookings)'
    else                             'delete_tenant'
  end                                     as action,
  user_id,
  company_id,
  shop_id
from candidates
order by created_at;


-- ============================================================================
-- PART 2 — DELETE (transaction; ends with ROLLBACK by default)
-- ============================================================================
-- Run Part 2 on its own (select the block, then Run). The Supabase SQL Editor
-- only shows the result of the LAST statement, so to see the summary table
-- keep the trailing `rollback;` / `commit;` as the last line and compare the
-- counts with Part 1 before switching to commit. After commit, re-run Part 1:
-- only `skip (...)` rows should remain.
begin;

create temp table _targets on commit drop as
with candidates as (
  select
    u.id                                                        as user_id,
    extract(day from now() - u.created_at)::int                 as age_days,
    up.company_id,
    up.shop_id,
    exists (
      select 1
      from public.user_roles ur
      join public.roles r on r.id = ur.role_id
      where ur.user_id = u.id and r.code = 'super_admin'
    )                                                           as is_super_admin,
    (
      (select count(*) from public.users_profile x where x.company_id = up.company_id and x.id      <> u.id)
    + (select count(*) from public.user_roles    x where x.company_id = up.company_id and x.user_id <> u.id)
    + (select count(*) from public.staff         x where x.company_id = up.company_id and x.user_id <> u.id)
    )                                                           as other_members,
    (select count(*) from public.bookings b where b.company_id = up.company_id) as bookings
  from auth.users u
  left join public.users_profile up on up.id = u.id
  where u.email_confirmed_at is null
    and u.confirmed_at       is null
    and u.phone_confirmed_at is null
    and u.last_sign_in_at    is null
)
select
  user_id,
  company_id,
  shop_id,
  case
    when company_id is null    then 'delete_user_only'
    when other_members > 0     then 'delete_user_only'
    else                            'delete_tenant'
  end as action
from candidates
where not is_super_admin
  and age_days >= 7                                             -- MIN_AGE_DAYS
  and not (company_id is not null and other_members = 0 and bookings > 0);

create temp table _tenants on commit drop as
select company_id, shop_id
from _targets
where action = 'delete_tenant';

-- ---- tenant-scoped rows (children first) ----------------------------------

-- booking children (tables from optional migrations are guarded)
do $$
declare
  t text;
begin
  foreach t in array array[
    'payment_slips',
    'payment_transactions',
    'booking_calendar_events'
  ] loop
    if to_regclass('public.' || t) is not null then
      execute format(
        'delete from public.%I where shop_id in (select shop_id from _tenants where shop_id is not null) '
        || 'or company_id in (select company_id from _tenants)', t);
    end if;
  end loop;
end $$;

delete from public.booking_logs                 where shop_id in (select shop_id from _tenants where shop_id is not null) or company_id in (select company_id from _tenants);
delete from public.booking_resource_assignments where shop_id in (select shop_id from _tenants where shop_id is not null) or company_id in (select company_id from _tenants);
delete from public.demo_chat_messages           where shop_id in (select shop_id from _tenants where shop_id is not null) or company_id in (select company_id from _tenants);
delete from public.notifications                where shop_id in (select shop_id from _tenants where shop_id is not null) or company_id in (select company_id from _tenants);
delete from public.upgrade_requests             where shop_id in (select shop_id from _tenants where shop_id is not null) or company_id in (select company_id from _tenants);
delete from public.bookings                     where shop_id in (select shop_id from _tenants where shop_id is not null) or company_id in (select company_id from _tenants);

-- shop-level rows
delete from public.queue_slots                  where shop_id in (select shop_id from _tenants where shop_id is not null) or company_id in (select company_id from _tenants);
delete from public.line_messages                where shop_id in (select shop_id from _tenants where shop_id is not null) or company_id in (select company_id from _tenants);
delete from public.customers                    where shop_id in (select shop_id from _tenants where shop_id is not null) or company_id in (select company_id from _tenants);
delete from public.line_users                   where shop_id in (select shop_id from _tenants where shop_id is not null) or company_id in (select company_id from _tenants);
delete from public.holidays                     where shop_id in (select shop_id from _tenants where shop_id is not null) or company_id in (select company_id from _tenants);
delete from public.working_hours                where shop_id in (select shop_id from _tenants where shop_id is not null) or company_id in (select company_id from _tenants);
delete from public.signage_settings             where shop_id in (select shop_id from _tenants where shop_id is not null) or company_id in (select company_id from _tenants);
delete from public.booking_resources            where shop_id in (select shop_id from _tenants where shop_id is not null) or company_id in (select company_id from _tenants);
delete from public.staff_branches               where shop_id in (select shop_id from _tenants where shop_id is not null) or company_id in (select company_id from _tenants);
delete from public.staff                        where shop_id in (select shop_id from _tenants where shop_id is not null) or company_id in (select company_id from _tenants);
delete from public.services                     where shop_id in (select shop_id from _tenants where shop_id is not null) or company_id in (select company_id from _tenants);
delete from public.service_categories           where shop_id in (select shop_id from _tenants where shop_id is not null) or company_id in (select company_id from _tenants);
delete from public.settings                     where shop_id in (select shop_id from _tenants where shop_id is not null) or company_id in (select company_id from _tenants);
delete from public.demo_sandbox_sessions        where shop_id in (select shop_id from _tenants where shop_id is not null) or company_id in (select company_id from _tenants);
delete from public.activity_logs                where shop_id in (select shop_id from _tenants where shop_id is not null) or company_id in (select company_id from _tenants);
delete from public.shop_subscriptions           where shop_id in (select shop_id from _tenants where shop_id is not null) or company_id in (select company_id from _tenants);

do $$
declare
  t text;
begin
  foreach t in array array[
    'google_calendar_connections',
    'shop_bank_deeplink_providers'
  ] loop
    if to_regclass('public.' || t) is not null then
      execute format(
        'delete from public.%I where shop_id in (select shop_id from _tenants where shop_id is not null) '
        || 'or company_id in (select company_id from _tenants)', t);
    end if;
  end loop;
end $$;

delete from public.branches                     where shop_id in (select shop_id from _tenants where shop_id is not null) or company_id in (select company_id from _tenants);
delete from public.user_roles                   where shop_id in (select shop_id from _tenants where shop_id is not null) or company_id in (select company_id from _tenants);
delete from public.users_profile                where shop_id in (select shop_id from _tenants where shop_id is not null) or company_id in (select company_id from _tenants);

-- ---- user-scoped rows (both delete_tenant and delete_user_only) -----------
delete from public.staff_branches where staff_id in (select id from public.staff where user_id in (select user_id from _targets));
delete from public.staff          where user_id in (select user_id from _targets);
delete from public.notifications  where user_id in (select user_id from _targets);
delete from public.activity_logs  where user_id in (select user_id from _targets);
delete from public.user_roles     where user_id in (select user_id from _targets);
delete from public.users_profile  where id      in (select user_id from _targets);

-- ---- tenant roots -----------------------------------------------------------
delete from public.shops     where id in (select shop_id from _tenants where shop_id is not null);
delete from public.shops     where company_id in (select company_id from _tenants);
delete from public.companies where id in (select company_id from _tenants);

-- ---- auth users (identities / sessions / refresh_tokens cascade) -----------
delete from auth.users where id in (select user_id from _targets);

-- summary before deciding
select action, count(*) from _targets group by action;

-- Dry run first. When the summary matches Part 1, replace ROLLBACK with COMMIT.
rollback;
-- commit;
