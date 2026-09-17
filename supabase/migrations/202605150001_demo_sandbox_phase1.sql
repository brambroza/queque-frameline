-- Phase 1: Demo Sandbox core schema

alter table if exists public.companies
  add column if not exists is_demo boolean not null default false,
  add column if not exists demo_business_type text;

alter table if exists public.shops
  add column if not exists is_demo boolean not null default false,
  add column if not exists demo_mode_enabled boolean not null default true,
  add column if not exists demo_business_type text,
  add column if not exists line_setup_completed boolean not null default false;

alter table if exists public.branches
  add column if not exists is_demo boolean not null default false;

alter table if exists public.services
  add column if not exists is_demo boolean not null default false;

alter table if exists public.bookings
  add column if not exists is_demo boolean not null default false;

alter table if exists public.booking_resources
  add column if not exists is_demo boolean not null default false;

alter table if exists public.line_messages
  add column if not exists is_demo boolean not null default false;

alter table if exists public.notifications
  add column if not exists is_demo boolean not null default false;

alter table if exists public.customers
  add column if not exists is_demo boolean not null default false;

alter table if exists public.line_users
  add column if not exists is_demo boolean not null default false;

alter table if exists public.booking_logs
  add column if not exists is_demo boolean not null default false;

alter table if exists public.signage_settings
  add column if not exists is_demo boolean not null default false;

create table if not exists public.demo_sandbox_sessions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  shop_id uuid not null references public.shops(id),
  user_id uuid references auth.users(id),
  business_type text not null,
  status text not null default 'active',
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  reset_count int not null default 0,
  last_reset_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_demo_sandbox_sessions_shop on public.demo_sandbox_sessions(shop_id);
create index if not exists idx_demo_sandbox_sessions_company on public.demo_sandbox_sessions(company_id);
create index if not exists idx_demo_sandbox_sessions_status on public.demo_sandbox_sessions(status);

create table if not exists public.demo_chat_messages (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  shop_id uuid not null references public.shops(id),
  branch_id uuid references public.branches(id),
  direction text not null,
  message_text text not null,
  message_type text not null default 'text',
  related_booking_id uuid references public.bookings(id),
  created_at timestamptz not null default now(),
  is_demo boolean not null default true
);

create index if not exists idx_demo_chat_messages_shop_created on public.demo_chat_messages(shop_id, created_at desc);
create index if not exists idx_demo_chat_messages_branch on public.demo_chat_messages(branch_id);

drop trigger if exists trg_demo_sandbox_sessions_updated_at on public.demo_sandbox_sessions;
create trigger trg_demo_sandbox_sessions_updated_at
before update on public.demo_sandbox_sessions
for each row execute function public.set_updated_at();

alter table if exists public.demo_sandbox_sessions enable row level security;
alter table if exists public.demo_chat_messages enable row level security;

drop policy if exists p_demo_sandbox_sessions_rw on public.demo_sandbox_sessions;
create policy p_demo_sandbox_sessions_rw
on public.demo_sandbox_sessions
for all
to authenticated
using (public.can_access_shop(shop_id))
with check (public.can_access_shop(shop_id));

drop policy if exists p_demo_chat_messages_rw on public.demo_chat_messages;
create policy p_demo_chat_messages_rw
on public.demo_chat_messages
for all
to authenticated
using (public.can_access_shop(shop_id))
with check (public.can_access_shop(shop_id));

grant select, insert, update, delete on table public.demo_sandbox_sessions to authenticated;
grant select, insert, update, delete on table public.demo_chat_messages to authenticated;
