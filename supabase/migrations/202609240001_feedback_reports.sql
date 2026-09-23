-- In-app feedback: bug reports / suggestions sent from the portal's floating
-- button. One row per report; the screenshot lives in the private Storage
-- bucket `feedback-screenshots` (service role only) and the report is also
-- e-mailed to FEEDBACK_TO_EMAIL. Rows stay even when SMTP fails so nothing
-- reported is lost.

create table if not exists public.feedback_reports (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  shop_id uuid not null references public.shops(id),
  branch_id uuid references public.branches(id),
  kind text not null,
  priority text not null,
  status text not null default 'new',
  reporter_name text not null,
  reporter_email text,
  reporter_role text,
  page_path text not null,
  page_label text,
  page_url text,
  description text not null,
  screenshot_path text,
  user_agent text,
  viewport text,
  app_version text,
  email_sent_at timestamptz,
  email_error text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid,
  constraint feedback_reports_kind_check check (kind in ('bug', 'suggestion')),
  constraint feedback_reports_priority_check check (priority in ('low', 'medium', 'high', 'urgent')),
  constraint feedback_reports_status_check check (status in ('new', 'acknowledged', 'in_progress', 'done', 'rejected'))
);

drop trigger if exists trg_feedback_reports_updated_at on public.feedback_reports;
create trigger trg_feedback_reports_updated_at
  before update on public.feedback_reports
  for each row execute function public.set_updated_at();

create index if not exists feedback_reports_shop_created_idx
  on public.feedback_reports (shop_id, created_at desc);

comment on table public.feedback_reports is 'Bug reports / suggestions submitted from the portal feedback button. Screenshot object path points into the private bucket feedback-screenshots.';
comment on column public.feedback_reports.email_error is 'Short reason the e-mail was not sent (mail_not_configured / smtp_failed). Never contains credentials or raw SMTP output.';

alter table public.feedback_reports enable row level security;

-- Any signed-in shop user may file a report as themselves.
drop policy if exists p_feedback_reports_insert on public.feedback_reports;
create policy p_feedback_reports_insert on public.feedback_reports
  for insert to authenticated
  with check (public.can_access_shop(shop_id) and created_by = auth.uid());

-- Admin-level users read + triage (status) — reserved for the future portal page.
drop policy if exists p_feedback_reports_admin_read on public.feedback_reports;
create policy p_feedback_reports_admin_read on public.feedback_reports
  for select to authenticated
  using (public.has_access_level('admin') and public.can_access_shop(shop_id));

drop policy if exists p_feedback_reports_admin_update on public.feedback_reports;
create policy p_feedback_reports_admin_update on public.feedback_reports
  for update to authenticated
  using (public.has_access_level('admin') and public.can_access_shop(shop_id))
  with check (public.has_access_level('admin') and public.can_access_shop(shop_id));

-- ---------------------------------------------------------------------------
-- Private Storage bucket for screenshots (Supabase only; skipped on plain
-- Postgres). No storage policies on purpose: the API route reads/writes with
-- the service role after checking the caller's session.
-- ---------------------------------------------------------------------------
do $outer$
begin
  if not exists (select 1 from pg_namespace where nspname = 'storage') then
    raise notice 'storage schema not available — feedback-screenshots bucket not created';
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('feedback-screenshots', 'feedback-screenshots', false, 3145728, array['image/jpeg', 'image/png'])
  on conflict (id) do nothing;
end
$outer$;
