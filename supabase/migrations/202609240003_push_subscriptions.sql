-- Browser (Web Push) subscriptions for the no-login driver page.
--
-- A driver who does not use LINE can still be told "ถึงคิวแล้ว" / "เลยเวลานัด":
-- the /driver/[token] page registers a service worker and stores the
-- PushSubscription here, scoped to that one booking. The server sends with
-- VAPID (env VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT).
--
-- Service-role only: the public token route writes, the notify helper reads.
-- No RLS policies on purpose — nothing in the portal needs these rows.

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  shop_id uuid not null references public.shops(id),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  audience text not null default 'driver',
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  last_sent_at timestamptz,
  last_error text,
  is_deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint push_subscriptions_audience_check check (audience in ('driver', 'customer')),
  constraint push_subscriptions_booking_endpoint_key unique (booking_id, endpoint)
);

drop trigger if exists trg_push_subscriptions_updated_at on public.push_subscriptions;
create trigger trg_push_subscriptions_updated_at
  before update on public.push_subscriptions
  for each row execute function public.set_updated_at();

create index if not exists push_subscriptions_booking_idx
  on public.push_subscriptions (booking_id)
  where is_deleted = false;

comment on table public.push_subscriptions is 'Web Push subscriptions of the driver / customer link pages, one row per (booking, browser endpoint). Written by the public token routes, read by the push notify helper — service role only.';
comment on column public.push_subscriptions.last_error is 'Short code of the last failed send (gone / http_<status> / send_failed). A "gone" endpoint is soft-deleted.';

alter table public.push_subscriptions enable row level security;
