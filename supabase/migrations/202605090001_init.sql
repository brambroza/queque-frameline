create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_name text,
  phone text,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  is_deleted boolean not null default false
);

create table if not exists public.shops (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  name text not null,
  shop_key text not null unique,
  logo_url text,
  phone text,
  email text,
  address text,
  line_channel_access_token text,
  line_channel_secret text,
  liff_id text,
  auto_reply_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  is_deleted boolean not null default false
);

create table if not exists public.branches (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  shop_id uuid not null references public.shops(id),
  branch_name text not null,
  address text,
  phone text,
  open_time time not null,
  close_time time not null,
  max_parallel_queues int not null default 1,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  is_deleted boolean not null default false
);

create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  is_deleted boolean not null default false
);

create table if not exists public.permissions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  is_deleted boolean not null default false
);

create table if not exists public.users_profile (
  id uuid primary key references auth.users(id),
  company_id uuid references public.companies(id),
  shop_id uuid references public.shops(id),
  full_name text,
  email text,
  phone text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  is_deleted boolean not null default false
);

create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  role_id uuid not null references public.roles(id),
  company_id uuid references public.companies(id),
  shop_id uuid references public.shops(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  is_deleted boolean not null default false
);

create unique index if not exists idx_user_roles_unique on public.user_roles(user_id, role_id, shop_id);

create table if not exists public.staff (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  company_id uuid not null references public.companies(id),
  shop_id uuid not null references public.shops(id),
  display_name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  is_deleted boolean not null default false
);

create table if not exists public.staff_branches (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  shop_id uuid not null references public.shops(id),
  staff_id uuid not null references public.staff(id),
  branch_id uuid not null references public.branches(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  is_deleted boolean not null default false
);

create table if not exists public.line_users (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id),
  shop_id uuid references public.shops(id),
  line_user_id text not null,
  display_name text,
  picture_url text,
  status_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  is_deleted boolean not null default false,
  unique(shop_id, line_user_id)
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  shop_id uuid not null references public.shops(id),
  line_user_id uuid references public.line_users(id),
  full_name text,
  phone text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  is_deleted boolean not null default false,
  unique(shop_id, phone)
);

create table if not exists public.service_categories (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  shop_id uuid not null references public.shops(id),
  category_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  is_deleted boolean not null default false
);

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  shop_id uuid not null references public.shops(id),
  category_id uuid references public.service_categories(id),
  service_name text not null,
  duration_minutes int not null default 30,
  capacity_per_slot int not null default 1,
  price numeric(12,2) not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  is_deleted boolean not null default false
);

create table if not exists public.working_hours (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  shop_id uuid not null references public.shops(id),
  branch_id uuid not null references public.branches(id),
  weekday int not null check (weekday >= 0 and weekday <= 6),
  open_time time not null,
  close_time time not null,
  break_start time,
  break_end time,
  slot_interval_minutes int not null default 30,
  capacity_per_slot int not null default 1,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  is_deleted boolean not null default false
);

create table if not exists public.holidays (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  shop_id uuid not null references public.shops(id),
  branch_id uuid references public.branches(id),
  holiday_date date not null,
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  is_deleted boolean not null default false
);

create table if not exists public.queue_slots (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  shop_id uuid not null references public.shops(id),
  branch_id uuid not null references public.branches(id),
  service_id uuid not null references public.services(id),
  slot_date date not null,
  slot_time time not null,
  capacity int not null,
  booked_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  is_deleted boolean not null default false
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'booking_status') THEN
    CREATE TYPE public.booking_status AS ENUM ('pending','confirmed','waiting','serving','completed','cancelled','no_show');
  END IF;
END$$;

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  shop_id uuid not null references public.shops(id),
  branch_id uuid not null references public.branches(id),
  service_id uuid not null references public.services(id),
  customer_id uuid not null references public.customers(id),
  line_user_id uuid references public.line_users(id),
  booking_date date not null,
  start_time time not null,
  end_time time,
  queue_number text not null,
  status public.booking_status not null default 'pending',
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  is_deleted boolean not null default false
);

create table if not exists public.booking_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  shop_id uuid not null references public.shops(id),
  booking_id uuid not null references public.bookings(id),
  action text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  is_deleted boolean not null default false
);

create table if not exists public.line_messages (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id),
  shop_id uuid references public.shops(id),
  line_user_id uuid references public.line_users(id),
  direction text not null,
  message_type text not null,
  message_text text,
  payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  is_deleted boolean not null default false
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id),
  shop_id uuid references public.shops(id),
  user_id uuid references auth.users(id),
  title text not null,
  body text,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  is_deleted boolean not null default false
);

create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id),
  shop_id uuid references public.shops(id),
  user_id uuid references auth.users(id),
  action text not null,
  target_table text,
  target_id uuid,
  payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  is_deleted boolean not null default false
);

create table if not exists public.settings (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id),
  shop_id uuid references public.shops(id),
  key text not null,
  value jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  is_deleted boolean not null default false,
  unique(shop_id, key)
);

create index if not exists idx_shops_company on public.shops(company_id);
create index if not exists idx_branches_shop on public.branches(shop_id);
create index if not exists idx_services_shop on public.services(shop_id);
create index if not exists idx_working_hours_shop_branch on public.working_hours(shop_id, branch_id, weekday);
create index if not exists idx_bookings_shop_date on public.bookings(shop_id, booking_date, status);
create index if not exists idx_line_messages_shop_created on public.line_messages(shop_id, created_at desc);

DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(array[
    'companies','shops','branches','roles','permissions','users_profile','user_roles','staff','staff_branches',
    'customers','line_users','service_categories','services','working_hours','holidays','queue_slots','bookings',
    'booking_logs','line_messages','notifications','activity_logs','settings'
  ])
  LOOP
    EXECUTE format('drop trigger if exists trg_%s_updated_at on public.%s;', t, t);
    EXECUTE format('create trigger trg_%s_updated_at before update on public.%s for each row execute function public.set_updated_at();', t, t);
  END LOOP;
END$$;
