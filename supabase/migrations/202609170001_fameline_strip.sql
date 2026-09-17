-- Fameline single-site: remove the SaaS / LINE / payment / demo / integration
-- features inherited from Queue. Runs after the full Queue chain so a fresh
-- database ends up with only what the dock-queue app uses.
--
-- Columns still read by retained code (shops.demo_mode_enabled, business_type,
-- liff_id, line_user_id on customers/bookings, ...) are left in place for now
-- and are removed together with the code that reads them (see CLAUDE.md TODO).

-- ---------------------------------------------------------------- dead tables
drop table if exists public.demo_chat_messages cascade;
drop table if exists public.demo_sandbox_sessions cascade;
drop table if exists public.upgrade_requests cascade;
drop table if exists public.shop_subscriptions cascade;
drop table if exists public.subscription_plans cascade;
drop table if exists public.contact_leads cascade;
drop table if exists public.booking_calendar_events cascade;
drop table if exists public.google_calendar_connections cascade;
drop table if exists public.payment_slips cascade;
drop table if exists public.payment_transactions cascade;
drop table if exists public.shop_bank_deeplink_providers cascade;
drop table if exists public.service_templates cascade;
drop table if exists public.line_messages cascade;

drop function if exists public.trigger_booking_reminders();

-- ---------------------------------------------------------------- shops: credentials / payment / rich menu
alter table public.shops
  drop column if exists line_channel_access_token,
  drop column if exists line_channel_secret,
  drop column if exists liff_id_login_shop,
  drop column if exists line_login_channel_id,
  drop column if exists auto_reply_enabled,
  drop column if exists booking_echo_enabled,
  drop column if exists qr_payment_enabled,
  drop column if exists omise_public_key,
  drop column if exists omise_secret_key,
  drop column if exists transfer_payment_enabled,
  drop column if exists promptpay_id,
  drop column if exists promptpay_display_name,
  drop column if exists bank_name,
  drop column if exists bank_account_no,
  drop column if exists bank_account_name,
  drop column if exists transfer_payment_window_minutes,
  drop column if exists mobile_banking_enabled,
  drop column if exists reminder_enabled,
  drop column if exists reminder_minutes,
  drop column if exists rich_menu_config,
  drop column if exists rich_menu_image_url,
  drop column if exists line_rich_menu_id,
  drop column if exists rich_menu_published_at,
  drop column if exists checklist,
  drop column if exists converted_at,
  drop column if exists converted_by;

-- ---------------------------------------------------------------- bookings: payment / LINE side channels
alter table public.bookings
  drop column if exists payment_status,
  drop column if exists payment_amount,
  drop column if exists payment_method,
  drop column if exists payment_expires_at,
  drop column if exists payment_verified_at,
  drop column if exists payment_verified_by,
  drop column if exists payment_reject_reason,
  drop column if exists paid_at,
  drop column if exists omise_charge_id,
  drop column if exists omise_qr_image_url,
  drop column if exists bank_provider,
  drop column if exists bank_txn_id,
  drop column if exists bank_txn_ref,
  drop column if exists bank_deeplink_url,
  drop column if exists reminder_sent_at;

-- ---------------------------------------------------------------- roles: admin | staff
-- The app's AppRole type is 'admin' | 'staff'. Old SaaS roles go away entirely.
insert into public.roles (code, name) values
  ('admin', 'Site admin'),
  ('staff', 'Gate / dock staff')
on conflict (code) do update set name = excluded.name;

delete from public.user_roles ur
using public.roles r
where r.id = ur.role_id and r.code in ('super_admin', 'shop_owner', 'branch_manager', 'customer');

delete from public.roles where code in ('super_admin', 'shop_owner', 'branch_manager', 'customer');

-- Single site: nobody is branch-bound, every staff member sees the whole yard.
-- (can_access_branch() short-circuits on this and the API layer treats both
-- roles as shop-wide — see src/lib/auth/branch-scope.ts.)
create or replace function public.is_branch_bound(p_shop_id uuid)
returns boolean
language sql
stable
as $$
  select false;
$$;

-- Translation management is an admin screen now.
create or replace function public.i18n_is_admin_or_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid()
      and ur.is_deleted = false
      and r.code = 'admin'
  );
$$;
