-- Service booking modes and templates

create table if not exists public.service_templates (
  id uuid primary key default gen_random_uuid(),
  business_category text not null,
  service_name text not null,
  booking_mode text not null check (booking_mode in ('fixed_slot','flexible_duration','capacity_based','walk_in','request_approval')),
  duration_minutes int,
  min_duration_minutes int,
  max_duration_minutes int,
  capacity_per_slot int,
  requires_approval boolean not null default false,
  allow_walk_in boolean not null default false,
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_service_templates_category on public.service_templates(business_category, sort_order);

alter table public.service_templates enable row level security;
drop policy if exists p_service_templates_read_all on public.service_templates;
create policy p_service_templates_read_all
  on public.service_templates
  for select
  to authenticated
  using (true);

-- Extend tenant services to support multiple booking models
alter table public.services
  add column if not exists booking_mode text not null default 'fixed_slot'
    check (booking_mode in ('fixed_slot','flexible_duration','capacity_based','walk_in','request_approval')),
  add column if not exists min_duration_minutes int,
  add column if not exists max_duration_minutes int,
  add column if not exists requires_approval boolean not null default false,
  add column if not exists allow_walk_in boolean not null default false;

