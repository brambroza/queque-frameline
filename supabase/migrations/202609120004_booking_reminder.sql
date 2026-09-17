-- Customer reminder pushed over LINE before the booking starts.
--
-- Per-shop toggle + lead time. Off by default: a shop that never opens the
-- setting sends nothing, so nobody gets an unexpected message on upgrade.
-- `reminder_minutes` is the lead time in minutes; the portal offers a fixed
-- set of presets (15/30 min, 1/2/3 h, 1 day) but the column accepts any
-- value in range so a later custom input needs no migration.
--
-- `bookings.reminder_sent_at` is the dedupe flag: the cron only picks rows
-- where it is null, and stamps it once a push went out (or once the row is
-- known to be unreachable, e.g. no LINE user), so a booking is reminded at
-- most once.

alter table public.shops
  add column if not exists reminder_enabled boolean not null default false,
  add column if not exists reminder_minutes integer not null default 60;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'shops_reminder_minutes_range'
  ) then
    alter table public.shops
      add constraint shops_reminder_minutes_range
      check (reminder_minutes between 5 and 10080);
  end if;
end $$;

comment on column public.shops.reminder_enabled is
  'When true, the booking-reminders cron pushes a LINE reminder to customers before their booking starts.';
comment on column public.shops.reminder_minutes is
  'Lead time in minutes before start_time at which the reminder is pushed (5 min .. 7 days).';

alter table public.bookings
  add column if not exists reminder_sent_at timestamptz;

comment on column public.bookings.reminder_sent_at is
  'When the pre-booking LINE reminder was pushed (or skipped as unreachable). Null = not yet handled.';

create index if not exists idx_bookings_reminder_pending
  on public.bookings (shop_id, booking_date, start_time)
  where reminder_sent_at is null and is_deleted = false;
