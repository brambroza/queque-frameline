-- LINE Official Account integration (single OA per site).
--
-- Customers / suppliers and drivers are bound to their LINE user by opening the
-- existing booking / driver links through LIFF; the site then pushes queue
-- updates to them. The warehouse team gets short messages in a LINE group
-- registered from inside the group.
--
-- `line_users`, `customers.line_user_id` and `bookings.line_user_id` already
-- exist (inherited from Queue) and are reused as-is.

create table if not exists public.line_config (
  shop_id uuid primary key references public.shops(id),
  company_id uuid not null references public.companies(id),
  channel_access_token text,              -- Messaging API long-lived token
  channel_secret text,                    -- webhook signature
  login_channel_id text,                  -- LINE Login channel that owns the LIFF app (ID token verify)
  liff_id text,
  oa_basic_id text,                       -- @xxxx for the add-friend button
  staff_group_id text,                    -- group registered with "ลงทะเบียนกลุ่ม"
  staff_group_name text,
  notify_customer boolean not null default true,
  notify_driver boolean not null default true,
  notify_staff_group boolean not null default true,
  webhook_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid
);

drop trigger if exists trg_line_config_updated_at on public.line_config;
create trigger trg_line_config_updated_at
  before update on public.line_config
  for each row execute function public.set_updated_at();

alter table public.bookings
  add column if not exists driver_line_user_id uuid references public.line_users(id),
  add column if not exists last_line_notify_at timestamptz;

create index if not exists bookings_driver_line_user_idx on public.bookings (driver_line_user_id);

-- Recent webhook events for support / debugging (no message bodies beyond the raw event).
create table if not exists public.line_events (
  id bigserial primary key,
  shop_id uuid references public.shops(id),
  event_type text not null,
  source_type text,                       -- user | group | room
  line_user_id text,
  group_id text,
  payload jsonb,
  created_at timestamptz not null default now()
);

create index if not exists line_events_shop_created_idx on public.line_events (shop_id, created_at desc);

-- RLS: portal admins read/write their site's config; the webhook and public
-- routes use the service role. line_events is service-role only.
alter table public.line_config enable row level security;
alter table public.line_events enable row level security;

drop policy if exists p_line_config_rw on public.line_config;
create policy p_line_config_rw on public.line_config
  for all to authenticated
  using (public.can_access_shop(shop_id)) with check (public.can_access_shop(shop_id));

-- line_users: portal reads display names for the "linked" badges.
alter table public.line_users enable row level security;
drop policy if exists p_line_users_read on public.line_users;
create policy p_line_users_read on public.line_users
  for select to authenticated
  using (public.can_access_shop(shop_id));
