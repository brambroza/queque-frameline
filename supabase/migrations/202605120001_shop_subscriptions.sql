create table if not exists public.subscription_plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  max_branches int,
  max_services int,
  max_staff int,
  max_resources int,
  max_monthly_bookings int,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.shop_subscriptions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  shop_id uuid not null references public.shops(id),
  plan_id uuid references public.subscription_plans(id),
  plan_code text,
  max_branches_override int,
  max_services_override int,
  max_staff_override int,
  max_resources_override int,
  max_monthly_bookings_override int,
  starts_at timestamptz default now(),
  expires_at timestamptz,
  is_active boolean not null default true,
  note text,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_deleted boolean not null default false,
  unique (shop_id)
);

create index if not exists idx_shop_subscriptions_shop on public.shop_subscriptions(shop_id);
create index if not exists idx_shop_subscriptions_company on public.shop_subscriptions(company_id);
create index if not exists idx_shop_subscriptions_active on public.shop_subscriptions(is_active, is_deleted);

insert into public.subscription_plans (code, name, max_branches, max_services, max_staff, max_resources, max_monthly_bookings, active)
values
  ('starter', 'Starter', 1, 10, 3, 20, 300, true),
  ('professional', 'Professional', 5, 999, 20, 200, 2000, true),
  ('business', 'Business', 20, 9999, 100, 1000, 10000, true),
  ('enterprise', 'Enterprise', null, null, null, null, null, true)
on conflict (code) do update
set name = excluded.name,
    max_branches = excluded.max_branches,
    max_services = excluded.max_services,
    max_staff = excluded.max_staff,
    max_resources = excluded.max_resources,
    max_monthly_bookings = excluded.max_monthly_bookings,
    active = excluded.active,
    updated_at = now();
