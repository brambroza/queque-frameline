-- Revenue ops: plan pricing metadata, free-forever starter alignment, upgrade request pipeline.
-- Sales-led model: payment happens off-platform; this migration only wires intent -> lead -> manual activation.

-- ---------------------------------------------------------------------------
-- 1. Pricing metadata on subscription_plans (single source of truth for price)
-- ---------------------------------------------------------------------------

alter table public.subscription_plans add column if not exists price_monthly int;
alter table public.subscription_plans add column if not exists price_yearly int;
alter table public.subscription_plans add column if not exists currency text not null default 'THB';
alter table public.subscription_plans add column if not exists sort_order int not null default 0;
alter table public.subscription_plans add column if not exists is_public boolean not null default true;
alter table public.subscription_plans add column if not exists contact_sales boolean not null default false;

-- ---------------------------------------------------------------------------
-- 2. Grandfather existing shops BEFORE tightening starter limits.
--    Existing starter shops keep the limits they were granted (300 bookings /
--    10 services) via the per-shop override columns, so nothing breaks the day
--    the tighter public starter tier ships.
-- ---------------------------------------------------------------------------

update public.shop_subscriptions ss
set
  max_branches_override         = coalesce(ss.max_branches_override, sp.max_branches),
  max_services_override         = coalesce(ss.max_services_override, sp.max_services),
  max_staff_override            = coalesce(ss.max_staff_override, sp.max_staff),
  max_resources_override        = coalesce(ss.max_resources_override, sp.max_resources),
  max_monthly_bookings_override = coalesce(ss.max_monthly_bookings_override, sp.max_monthly_bookings),
  note                          = coalesce(ss.note, 'grandfathered at 202608190001'),
  updated_at                    = now()
from public.subscription_plans sp
where sp.id = ss.plan_id
  and sp.code = 'starter'
  and ss.is_deleted = false;

-- Starter is free forever from now on: drop the 90-day expiry bomb that
-- registration used to set. Paid plans keep their expiry (sales-led renewal).
update public.shop_subscriptions ss
set expires_at = null,
    updated_at = now()
where ss.is_deleted = false
  and ss.expires_at is not null
  and coalesce(ss.plan_code, '') = 'starter';

-- ---------------------------------------------------------------------------
-- 3. Align plan limits + prices with what the marketing site advertises.
--    Starter = free forever, quota-limited.
-- ---------------------------------------------------------------------------

update public.subscription_plans
set max_branches = 1,
    max_services = 3,
    max_staff = 3,
    max_resources = 10,
    max_monthly_bookings = 50,
    price_monthly = 0,
    price_yearly = 0,
    sort_order = 1,
    is_public = true,
    contact_sales = false,
    updated_at = now()
where code = 'starter';

update public.subscription_plans
set price_monthly = 990,
    price_yearly = 9900,
    sort_order = 2,
    is_public = true,
    contact_sales = false,
    updated_at = now()
where code = 'professional';

update public.subscription_plans
set price_monthly = 2490,
    price_yearly = 24900,
    sort_order = 3,
    is_public = true,
    contact_sales = false,
    updated_at = now()
where code = 'business';

update public.subscription_plans
set price_monthly = null,
    price_yearly = null,
    sort_order = 4,
    is_public = true,
    contact_sales = true,
    updated_at = now()
where code = 'enterprise';

-- ---------------------------------------------------------------------------
-- 4. Backfill: every shop must own a subscription row. Missing row previously
--    meant "unlimited" in the enforcement layer; it now means starter, and the
--    row makes that explicit.
-- ---------------------------------------------------------------------------

insert into public.shop_subscriptions (company_id, shop_id, plan_id, plan_code, starts_at, expires_at, is_active, note)
select s.company_id,
       s.id,
       sp.id,
       sp.code,
       now(),
       null,
       true,
       'backfilled at 202608190001'
from public.shops s
cross join lateral (select id, code from public.subscription_plans where code = 'starter' limit 1) sp
where not exists (
  select 1 from public.shop_subscriptions ss
  where ss.shop_id = s.id and ss.is_deleted = false
)
on conflict (shop_id) do nothing;

-- ---------------------------------------------------------------------------
-- 5. Upgrade requests: the sales-led "I want to pay" pipeline.
-- ---------------------------------------------------------------------------

create table if not exists public.upgrade_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id),
  shop_id uuid references public.shops(id),
  requested_plan_code text not null,
  current_plan_code text,
  contact_name text,
  phone text,
  email text,
  note text,
  source text not null default 'portal',
  status text not null default 'new',
  handled_by uuid,
  handled_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_upgrade_requests_created_at on public.upgrade_requests (created_at desc);
create index if not exists idx_upgrade_requests_status on public.upgrade_requests (status);
create index if not exists idx_upgrade_requests_shop on public.upgrade_requests (shop_id);

alter table public.upgrade_requests enable row level security;

-- Service-role only, same posture as contact_leads: all reads/writes go through
-- route handlers that enforce the role check themselves.
drop policy if exists upgrade_requests_no_direct_access on public.upgrade_requests;
create policy upgrade_requests_no_direct_access on public.upgrade_requests
for all
to authenticated, anon
using (false)
with check (false);
