-- Fameline dock queue: domain additions on top of the Queue core.
--
-- Mapping of inherited tables to the dock domain (kept to avoid renaming
-- ~200 call sites — see CLAUDE.md "Domain model"):
--   services          = vehicle types (duration per type, + direction/buffer)
--   booking_resources = docks (resource_type 'dock', + direction; service_ids = vehicle types allowed)
--   customers         = partners (customer | supplier)
--   working_hours     = dock opening hours (+ direction)
--   booking_logs      = booking audit log (+ from/to/actor_kind)

-- ---------------------------------------------------------------- enums
do $$
begin
  if not exists (select 1 from pg_type where typname = 'booking_direction') then
    create type public.booking_direction as enum ('inbound', 'outbound');
  end if;
  if not exists (select 1 from pg_type where typname = 'partner_type') then
    create type public.partner_type as enum ('customer', 'supplier');
  end if;
  if not exists (select 1 from pg_type where typname = 'document_type') then
    create type public.document_type as enum ('so', 'po');
  end if;
  if not exists (select 1 from pg_type where typname = 'document_status') then
    create type public.document_status as enum ('open', 'booked', 'completed', 'cancelled');
  end if;
  if not exists (select 1 from pg_type where typname = 'document_source') then
    create type public.document_source as enum ('api', 'csv', 'manual');
  end if;
  if not exists (select 1 from pg_type where typname = 'auto_call_mode') then
    create type public.auto_call_mode as enum ('off', 'dock_free', 'time', 'hybrid');
  end if;
end $$;

-- Past the grace window and not arrived yet; still callable if the truck shows up.
alter type public.booking_status add value if not exists 'late';

-- ---------------------------------------------------------------- services = vehicle types
alter table public.services
  add column if not exists direction public.booking_direction,
  add column if not exists buffer_minutes int not null default 0,
  add column if not exists sort_order int not null default 0;

alter table public.services drop constraint if exists services_buffer_minutes_range;
alter table public.services
  add constraint services_buffer_minutes_range check (buffer_minutes >= 0 and buffer_minutes <= 240);

comment on column public.services.direction is 'inbound | outbound | null = usable for both directions';
comment on column public.services.buffer_minutes is 'Dock turnaround time blocked after a vehicle of this type (not shown to the customer)';

-- ---------------------------------------------------------------- booking_resources = docks
alter table public.booking_resources
  add column if not exists direction public.booking_direction;

comment on column public.booking_resources.direction is 'inbound | outbound | null = dock serves both directions';
comment on column public.booking_resources.service_ids is 'Vehicle types (services.id) allowed on this dock; null/empty = all';

-- ---------------------------------------------------------------- working_hours
alter table public.working_hours
  add column if not exists direction public.booking_direction;

comment on column public.working_hours.direction is 'Row applies to this direction only; null = both';

-- ---------------------------------------------------------------- customers = partners
alter table public.customers
  add column if not exists partner_type public.partner_type not null default 'customer',
  add column if not exists code text,
  add column if not exists email text,
  add column if not exists address text;

-- A supplier and a customer may share a phone; uniqueness is per partner type.
alter table public.customers drop constraint if exists customers_shop_id_phone_key;
create unique index if not exists customers_shop_type_phone_uidx
  on public.customers (shop_id, partner_type, phone)
  where phone is not null and is_deleted = false;
create unique index if not exists customers_shop_type_code_uidx
  on public.customers (shop_id, partner_type, code)
  where code is not null and is_deleted = false;

comment on column public.customers.code is 'ERP partner code (customer code / vendor code); used to match imported SO/PO';

-- ---------------------------------------------------------------- external documents (SO / PO)
create table if not exists public.external_documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  shop_id uuid not null references public.shops(id),
  doc_type public.document_type not null,
  doc_no text not null,
  partner_id uuid references public.customers(id),
  partner_code text,
  partner_name text,
  doc_date date,
  due_date date,
  status public.document_status not null default 'open',
  source public.document_source not null default 'manual',
  items jsonb not null default '[]'::jsonb,
  total_qty numeric(14,3),
  remark text,
  booking_token_hash text,
  booking_token_expires_at timestamptz,
  raw jsonb,
  imported_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  is_deleted boolean not null default false,
  unique (shop_id, doc_type, doc_no)
);

create unique index if not exists external_documents_token_uidx
  on public.external_documents (booking_token_hash)
  where booking_token_hash is not null;
create index if not exists external_documents_shop_status_idx
  on public.external_documents (shop_id, doc_type, status);
create index if not exists external_documents_partner_idx
  on public.external_documents (partner_id);

drop trigger if exists trg_external_documents_updated_at on public.external_documents;
create trigger trg_external_documents_updated_at
  before update on public.external_documents
  for each row execute function public.set_updated_at();

comment on table public.external_documents is 'Sales orders (outbound pickup) and purchase orders (inbound delivery) imported from the ERP, CSV or typed in by admin';
comment on column public.external_documents.items is '[{"sku","name","qty","uom"}]';
comment on column public.external_documents.booking_token_hash is 'sha256 of the customer booking-link token; raw token is never stored';

-- ---------------------------------------------------------------- site settings (one row per shop)
create table if not exists public.site_settings (
  shop_id uuid primary key references public.shops(id),
  company_id uuid not null references public.companies(id),
  grace_minutes int not null default 30,
  early_arrival_minutes int not null default 60,
  auto_call_mode public.auto_call_mode not null default 'dock_free',
  auto_call_lead_minutes int not null default 0,
  called_timeout_minutes int not null default 15,
  auto_no_show_after_grace boolean not null default true,
  booking_token_ttl_days int not null default 7,
  driver_token_ttl_days int not null default 3,
  booking_lead_min_hours int not null default 2,
  booking_horizon_days int not null default 30,
  require_admin_confirm boolean not null default true,
  driver_self_checkin boolean not null default false,
  do_number_format text not null default 'DO-{YYYYMM}-{NNNN}',
  auto_call_last_run_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid,
  constraint site_settings_ranges check (
    grace_minutes between 0 and 720
    and early_arrival_minutes between 0 and 1440
    and auto_call_lead_minutes between 0 and 180
    and called_timeout_minutes between 1 and 240
    and booking_token_ttl_days between 1 and 90
    and driver_token_ttl_days between 1 and 90
    and booking_lead_min_hours between 0 and 168
    and booking_horizon_days between 1 and 365
  )
);

drop trigger if exists trg_site_settings_updated_at on public.site_settings;
create trigger trg_site_settings_updated_at
  before update on public.site_settings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------- bookings: dock queue columns
alter table public.bookings
  add column if not exists direction public.booking_direction not null default 'outbound',
  add column if not exists document_id uuid references public.external_documents(id),
  add column if not exists buffer_minutes int not null default 0,
  add column if not exists plate_number text,
  add column if not exists plate_number_actual text,
  add column if not exists plate_changed_at timestamptz,
  add column if not exists plate_changed_by uuid,
  add column if not exists driver_name text,
  add column if not exists driver_phone text,
  add column if not exists receiver_name text,
  add column if not exists receiver_phone text,
  add column if not exists booking_source text not null default 'admin',
  add column if not exists confirmed_at timestamptz,
  add column if not exists confirmed_by uuid,
  add column if not exists arrived_at timestamptz,
  add column if not exists grace_deadline timestamptz,
  add column if not exists called_timeout_at timestamptz,
  add column if not exists serving_started_at timestamptz,
  add column if not exists completed_at timestamptz,
  add column if not exists cancel_reason text,
  add column if not exists cancelled_by uuid,
  add column if not exists auto_called boolean not null default false,
  add column if not exists driver_token_hash text,
  add column if not exists driver_token_expires_at timestamptz,
  add column if not exists do_number text,
  add column if not exists do_issued_at timestamptz,
  add column if not exists do_issued_by uuid,
  add column if not exists do_pdf_url text;

alter table public.bookings drop constraint if exists bookings_booking_source_check;
alter table public.bookings
  add constraint bookings_booking_source_check check (booking_source in ('customer_link', 'admin', 'api'));

create unique index if not exists bookings_do_number_uidx
  on public.bookings (shop_id, do_number) where do_number is not null;
create unique index if not exists bookings_driver_token_uidx
  on public.bookings (driver_token_hash) where driver_token_hash is not null;
create index if not exists bookings_shop_status_grace_idx
  on public.bookings (shop_id, status, grace_deadline);
create index if not exists bookings_document_idx
  on public.bookings (document_id);
create index if not exists bookings_resource_date_idx
  on public.bookings (resource_id, booking_date);
create index if not exists bookings_plate_idx
  on public.bookings (shop_id, plate_number);

comment on column public.bookings.buffer_minutes is 'Snapshot of services.buffer_minutes at booking time; dock stays blocked until end_time + buffer';
comment on column public.bookings.plate_number is 'Plate as booked (normalised: no spaces, upper case)';
comment on column public.bookings.plate_number_actual is 'Plate seen at the gate when it differs from plate_number (staff edit, audited)';
comment on column public.bookings.grace_deadline is 'start_time + site_settings.grace_minutes; cron flips confirmed -> late after this';

-- ---------------------------------------------------------------- booking_logs = audit log
alter table public.booking_logs
  add column if not exists from_value jsonb,
  add column if not exists to_value jsonb,
  add column if not exists actor_kind text;

alter table public.booking_logs drop constraint if exists booking_logs_actor_kind_check;
alter table public.booking_logs
  add constraint booking_logs_actor_kind_check
  check (actor_kind is null or actor_kind in ('admin', 'staff', 'customer', 'driver', 'system'));

create index if not exists booking_logs_booking_idx on public.booking_logs (booking_id, created_at);

-- ---------------------------------------------------------------- API keys (ERP integration)
create table if not exists public.api_keys (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  shop_id uuid not null references public.shops(id),
  name text not null,
  key_hash text not null unique,
  key_prefix text not null,
  scopes text[] not null default array['documents:write']::text[],
  last_used_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid,
  is_deleted boolean not null default false
);

comment on column public.api_keys.key_hash is 'sha256 of the raw key; the raw key is shown once at creation';

-- ---------------------------------------------------------------- DO numbering
create table if not exists public.do_counters (
  shop_id uuid not null references public.shops(id),
  period text not null,
  last_no int not null default 0,
  primary key (shop_id, period)
);

/*
 * Next delivery-order number for a shop, gap-free within a period.
 * Format placeholders: {YYYYMM} {YYYY} {NNNN} (zero padded, width = number of N).
 * The counter row is upserted with a row lock, so concurrent confirmations never
 * receive the same number.
 */
create or replace function public.next_do_number(p_shop_id uuid, p_format text default 'DO-{YYYYMM}-{NNNN}')
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_period text := to_char((now() at time zone 'Asia/Bangkok'), 'YYYYMM');
  v_no int;
  v_pad int;
  v_out text;
begin
  insert into public.do_counters (shop_id, period, last_no)
  values (p_shop_id, v_period, 1)
  on conflict (shop_id, period) do update set last_no = public.do_counters.last_no + 1
  returning last_no into v_no;

  v_pad := greatest(length(coalesce(substring(p_format from '\{(N+)\}'), 'NNNN')), 1);
  v_out := replace(p_format, '{YYYYMM}', v_period);
  v_out := replace(v_out, '{YYYY}', left(v_period, 4));
  v_out := regexp_replace(v_out, '\{N+\}', lpad(v_no::text, v_pad, '0'));
  return v_out;
end;
$$;

revoke all on function public.next_do_number(uuid, text) from public;
grant execute on function public.next_do_number(uuid, text) to authenticated, service_role;

-- ---------------------------------------------------------------- RLS for the new tables
alter table public.external_documents enable row level security;
alter table public.site_settings enable row level security;
alter table public.api_keys enable row level security;
alter table public.do_counters enable row level security;

drop policy if exists p_external_documents_rw on public.external_documents;
create policy p_external_documents_rw on public.external_documents
  for all to authenticated
  using (public.can_access_shop(shop_id)) with check (public.can_access_shop(shop_id));

drop policy if exists p_site_settings_rw on public.site_settings;
create policy p_site_settings_rw on public.site_settings
  for all to authenticated
  using (public.can_access_shop(shop_id)) with check (public.can_access_shop(shop_id));

-- API keys are managed through the service-role client only (never exposed to the session client).
drop policy if exists p_api_keys_read on public.api_keys;
create policy p_api_keys_read on public.api_keys
  for select to authenticated
  using (public.can_access_shop(shop_id));

-- do_counters: no policy for authenticated — only next_do_number() (security definer) touches it.
