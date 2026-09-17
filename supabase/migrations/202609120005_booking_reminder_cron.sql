-- Scheduler for the booking reminder.
--
-- Vercel Hobby only runs crons once a day, and a reminder measured in minutes
-- needs a tick every few minutes. pg_cron + pg_net inside Supabase call the
-- app route instead, so the schedule lives with the database and nothing in
-- git carries the app URL or the shared secret.
--
-- Before this migration runs in an environment, create both secrets in
-- Supabase Vault (Dashboard -> Project Settings -> Vault, or SQL editor):
--
--   select vault.create_secret('https://your-app.vercel.app', 'cron_app_url');
--   select vault.create_secret('<same value as CRON_SECRET env>', 'cron_secret');
--
-- Until both exist the trigger function returns without calling anything, so
-- applying this migration early is harmless.

create extension if not exists pg_cron;
create extension if not exists pg_net;

create or replace function public.trigger_booking_reminders()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text;
  v_secret text;
begin
  select decrypted_secret into v_url
    from vault.decrypted_secrets
   where name = 'cron_app_url'
   limit 1;
  select decrypted_secret into v_secret
    from vault.decrypted_secrets
   where name = 'cron_secret'
   limit 1;

  if v_url is null or v_secret is null then
    return;
  end if;

  perform net.http_get(
    url := rtrim(v_url, '/') || '/api/cron/booking-reminders',
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_secret),
    timeout_milliseconds := 30000
  );
end;
$$;

revoke all on function public.trigger_booking_reminders() from public;

-- Re-register idempotently so re-running the migration does not stack jobs.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'booking-reminders') then
    perform cron.unschedule('booking-reminders');
  end if;
end $$;

select cron.schedule(
  'booking-reminders',
  '*/5 * * * *',
  $$select public.trigger_booking_reminders()$$
);
