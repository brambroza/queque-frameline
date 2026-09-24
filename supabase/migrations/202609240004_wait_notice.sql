-- "กรุณารอสักครู่": a checked-in truck whose appointment time has passed but
-- whose dock is still busy gets one notice (LINE + Web Push + banner on the
-- driver page). The cron sweep sends it `wait_notice_minutes` after the
-- appointment start and stamps `wait_notified_at` so it is never repeated.

alter table public.site_settings
  add column if not exists wait_notice_enabled boolean not null default true,
  add column if not exists wait_notice_minutes int not null default 5;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'site_settings_wait_notice_minutes_range') then
    alter table public.site_settings
      add constraint site_settings_wait_notice_minutes_range check (wait_notice_minutes between 0 and 240);
  end if;
end $$;

comment on column public.site_settings.wait_notice_minutes is 'Minutes after the appointment start before a still-waiting (checked_in) driver is told the dock is delayed. 0 = at the appointment time.';

alter table public.bookings
  add column if not exists wait_notified_at timestamptz;

comment on column public.bookings.wait_notified_at is 'When the driver was told "dock delayed, please wait" (once per booking). Null = not yet.';
