-- Bring legacy public.notifications schema to phase-1 notification schema safely.

alter table if exists public.notifications
  add column if not exists branch_id uuid references public.branches(id);

alter table if exists public.notifications
  add column if not exists type text not null default 'system_info';

alter table if exists public.notifications
  add column if not exists category text not null default 'system';

alter table if exists public.notifications
  add column if not exists priority text not null default 'medium';

alter table if exists public.notifications
  add column if not exists message text;

alter table if exists public.notifications
  add column if not exists related_type text;

alter table if exists public.notifications
  add column if not exists related_id uuid;

alter table if exists public.notifications
  add column if not exists action_url text;

alter table if exists public.notifications
  add column if not exists icon text;

alter table if exists public.notifications
  add column if not exists color text;

alter table if exists public.notifications
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table if exists public.notifications
  add column if not exists archived_at timestamptz;

alter table if exists public.notifications
  add column if not exists is_read boolean not null default false;

alter table if exists public.notifications
  add column if not exists is_archived boolean not null default false;

-- Backfill compatibility values
update public.notifications
set
  message = coalesce(message, body, title),
  is_read = coalesce(is_read, read_at is not null),
  type = coalesce(type, 'system_info'),
  category = coalesce(category, 'system'),
  priority = coalesce(priority, 'medium')
where true;

-- Helpful indexes
create index if not exists notifications_company_id_idx on public.notifications(company_id);
create index if not exists notifications_shop_id_idx on public.notifications(shop_id);
create index if not exists notifications_branch_id_idx on public.notifications(branch_id);
create index if not exists notifications_is_read_idx on public.notifications(is_read);
create index if not exists notifications_is_archived_idx on public.notifications(is_archived);
create index if not exists notifications_category_idx on public.notifications(category);
create index if not exists notifications_priority_idx on public.notifications(priority);
create index if not exists notifications_created_at_idx on public.notifications(created_at desc);

-- Ensure RLS is enabled and uses existing helper function.
alter table if exists public.notifications enable row level security;

drop policy if exists p_notifications_rw on public.notifications;
create policy p_notifications_rw
on public.notifications
for all
to authenticated
using (
  public.can_access_shop(shop_id)
  or user_id = auth.uid()
)
with check (
  public.can_access_shop(shop_id)
  or user_id = auth.uid()
);

grant select, insert, update, delete on table public.notifications to authenticated;
