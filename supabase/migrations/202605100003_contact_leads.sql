create table if not exists public.contact_leads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  company_name text,
  phone text,
  email text,
  business_type text,
  message text,
  source text not null default 'website',
  status text not null default 'new',
  created_at timestamptz not null default now()
);

create index if not exists idx_contact_leads_created_at on public.contact_leads (created_at desc);
create index if not exists idx_contact_leads_status on public.contact_leads (status);
create index if not exists idx_contact_leads_email on public.contact_leads (email);

alter table public.contact_leads enable row level security;

drop policy if exists contact_leads_no_direct_access on public.contact_leads;
create policy contact_leads_no_direct_access on public.contact_leads
for all
to authenticated, anon
using (false)
with check (false);
