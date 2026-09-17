-- Per-shop Google Calendar OAuth credentials and booking event mappings.
-- Both tables are server-only: the service role is required to access them.

create table if not exists public.google_calendar_connections (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  shop_id uuid not null references public.shops(id),
  calendar_id text not null default 'primary',
  access_token_encrypted text not null,
  refresh_token_encrypted text not null,
  token_expires_at timestamptz,
  granted_scope text,
  connected_by uuid references auth.users(id),
  last_synced_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  unique(shop_id)
);

create table if not exists public.booking_calendar_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  shop_id uuid not null references public.shops(id),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  calendar_id text not null default 'primary',
  google_event_id text not null,
  google_event_url text,
  last_synced_at timestamptz not null default now(),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(shop_id, booking_id)
);

create index if not exists idx_google_calendar_connections_company_shop
  on public.google_calendar_connections(company_id, shop_id);

create index if not exists idx_booking_calendar_events_booking
  on public.booking_calendar_events(shop_id, booking_id);

drop trigger if exists trg_google_calendar_connections_updated_at on public.google_calendar_connections;
create trigger trg_google_calendar_connections_updated_at
before update on public.google_calendar_connections
for each row execute function public.set_updated_at();

drop trigger if exists trg_booking_calendar_events_updated_at on public.booking_calendar_events;
create trigger trg_booking_calendar_events_updated_at
before update on public.booking_calendar_events
for each row execute function public.set_updated_at();

alter table public.google_calendar_connections enable row level security;
alter table public.booking_calendar_events enable row level security;

revoke all on table public.google_calendar_connections from anon, authenticated;
revoke all on table public.booking_calendar_events from anon, authenticated;
grant all on table public.google_calendar_connections to service_role;
grant all on table public.booking_calendar_events to service_role;
