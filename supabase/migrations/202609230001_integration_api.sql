-- ERP push API (Dynamics AX 2012 -> /api/integration/v1/*).
--
-- 1. api_keys: lifecycle columns (revoke audit, last caller IP, updated_at).
-- 2. integration_logs: one row per push request so the portal can show what
--    the ERP sent, what was written and which documents failed. Failures keep
--    only {index, doc_no, code, message} — never the payload — and the table
--    is written by the API route (service role) only.
-- 3. 90-day retention via pg_cron when available (skipped on plain Postgres).

-- ---------------------------------------------------------------------------
-- api_keys
-- ---------------------------------------------------------------------------
alter table public.api_keys
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists updated_by uuid,
  add column if not exists revoked_at timestamptz,
  add column if not exists revoked_by uuid,
  add column if not exists last_used_ip text;

drop trigger if exists trg_api_keys_updated_at on public.api_keys;
create trigger trg_api_keys_updated_at
  before update on public.api_keys
  for each row execute function public.set_updated_at();

create index if not exists api_keys_shop_active_idx
  on public.api_keys (shop_id) where is_deleted = false;

comment on column public.api_keys.revoked_at is 'Set when an admin revokes the key; active is false from then on and the key never comes back.';
comment on column public.api_keys.last_used_ip is 'Client IP of the last accepted request (x-forwarded-for), for support only.';

-- ---------------------------------------------------------------------------
-- integration_logs
-- ---------------------------------------------------------------------------
create table if not exists public.integration_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  shop_id uuid not null references public.shops(id),
  api_key_id uuid references public.api_keys(id),
  doc_type public.document_type not null,
  request_id text,
  received_at timestamptz not null default now(),
  duration_ms int,
  status text not null,
  count_received int not null default 0,
  count_created int not null default 0,
  count_updated int not null default 0,
  count_failed int not null default 0,
  error_summary text,
  failures jsonb,
  dry_run boolean not null default false,
  source_ip text,
  user_agent text,
  constraint integration_logs_status_check check (status in ('ok', 'partial', 'failed', 'rejected'))
);

create index if not exists integration_logs_shop_received_idx
  on public.integration_logs (shop_id, received_at desc);

comment on table public.integration_logs is 'One row per ERP push request (sales-orders / purchase-orders). ok = nothing failed, partial = some documents failed, failed = every document failed, rejected = the request body was refused.';
comment on column public.integration_logs.failures is 'First 50 failed documents: [{"index","doc_no","code","message"}]. The payload itself is never stored here.';

alter table public.integration_logs enable row level security;

-- Portal reads the history; only the API route (service role) writes.
drop policy if exists p_integration_logs_read on public.integration_logs;
create policy p_integration_logs_read on public.integration_logs
  for select to authenticated
  using (public.can_access_shop(shop_id));

-- ---------------------------------------------------------------------------
-- Retention: keep 90 days (pg_cron only; harmless elsewhere)
-- ---------------------------------------------------------------------------
do $outer$
begin
  if not exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    raise notice 'pg_cron not available — integration_logs retention not scheduled';
    return;
  end if;

  create extension if not exists pg_cron;

  if exists (select 1 from cron.job where jobname = 'fameline-integration-logs-retention') then
    perform cron.unschedule('fameline-integration-logs-retention');
  end if;
  perform cron.schedule(
    'fameline-integration-logs-retention',
    '30 20 * * *', -- 03:30 Asia/Bangkok
    $job$delete from public.integration_logs where received_at < now() - interval '90 days'$job$
  );
end
$outer$;
