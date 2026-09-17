-- Minute tick for the overdue sweep + auto-call.
--
-- Vercel Hobby runs crons once a day, so the schedule lives in Supabase:
-- pg_cron + pg_net call the app route. Nothing in git carries the URL or secret.
--
-- Before this does anything, create both secrets in Supabase Vault
-- (Dashboard -> Project Settings -> Vault, or SQL editor):
--
--   select vault.create_secret('https://<your-app>', 'cron_app_url');
--   select vault.create_secret('<same value as CRON_SECRET env>', 'cron_secret');
--
-- Until both exist the function returns quietly, so applying this early is harmless.
-- On plain PostgreSQL (no pg_cron / pg_net / vault) the whole file is skipped.

do $outer$
begin
  if not exists (select 1 from pg_available_extensions where name = 'pg_cron')
     or not exists (select 1 from pg_available_extensions where name = 'pg_net') then
    raise notice 'pg_cron / pg_net not available — auto-call cron not scheduled';
    return;
  end if;

  create extension if not exists pg_cron;
  create extension if not exists pg_net;

  execute $fn$
    create or replace function public.trigger_auto_call()
    returns void
    language plpgsql
    security definer
    set search_path = public
    as $body$
    declare
      v_url text;
      v_secret text;
    begin
      select decrypted_secret into v_url from vault.decrypted_secrets where name = 'cron_app_url' limit 1;
      select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'cron_secret' limit 1;
      if v_url is null or v_secret is null then
        return;
      end if;
      perform net.http_get(
        url := rtrim(v_url, '/') || '/api/cron/auto-call',
        headers := jsonb_build_object('Authorization', 'Bearer ' || v_secret),
        timeout_milliseconds := 20000
      );
    end;
    $body$;
  $fn$;

  execute 'revoke all on function public.trigger_auto_call() from public';

  -- Re-register idempotently so re-running the migration does not stack jobs.
  if exists (select 1 from cron.job where jobname = 'fameline-auto-call') then
    perform cron.unschedule('fameline-auto-call');
  end if;
  perform cron.schedule('fameline-auto-call', '* * * * *', 'select public.trigger_auto_call()');
end
$outer$;
