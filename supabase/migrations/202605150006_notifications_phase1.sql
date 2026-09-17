create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id),
  shop_id uuid references public.shops(id),
  user_id uuid references auth.users(id),
  title text not null,
  body text,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  is_deleted boolean not null default false
);

alter table if exists public.notifications add column if not exists branch_id uuid references public.branches(id);
alter table if exists public.notifications add column if not exists type text not null default 'system_info';
alter table if exists public.notifications add column if not exists category text not null default 'system';
alter table if exists public.notifications add column if not exists priority text not null default 'medium';
alter table if exists public.notifications add column if not exists message text;
alter table if exists public.notifications add column if not exists related_type text;
alter table if exists public.notifications add column if not exists related_id uuid;
alter table if exists public.notifications add column if not exists action_url text;
alter table if exists public.notifications add column if not exists icon text;
alter table if exists public.notifications add column if not exists color text;
alter table if exists public.notifications add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table if exists public.notifications add column if not exists archived_at timestamptz;
alter table if exists public.notifications add column if not exists is_read boolean not null default false;
alter table if exists public.notifications add column if not exists is_archived boolean not null default false;

update public.notifications
set message = coalesce(message, body, title),
    is_read = coalesce(is_read, read_at is not null),
    type = coalesce(type, 'system_info'),
    category = coalesce(category, 'system'),
    priority = coalesce(priority, 'medium')
where true;

create index if not exists notifications_company_id_idx on public.notifications(company_id);
create index if not exists notifications_shop_id_idx on public.notifications(shop_id);
create index if not exists notifications_branch_id_idx on public.notifications(branch_id);
create index if not exists notifications_is_read_idx on public.notifications(is_read);
create index if not exists notifications_is_archived_idx on public.notifications(is_archived);
create index if not exists notifications_category_idx on public.notifications(category);
create index if not exists notifications_priority_idx on public.notifications(priority);
create index if not exists notifications_created_at_idx on public.notifications(created_at desc);

alter table if exists public.notifications enable row level security;

drop policy if exists p_notifications_rw on public.notifications;
create policy p_notifications_rw on public.notifications
for all
using (
  public.has_role('super_admin')
  or public.can_access_shop(shop_id)
  or user_id = auth.uid()
)
with check (
  public.has_role('super_admin')
  or public.can_access_shop(shop_id)
  or user_id = auth.uid()
);

drop trigger if exists trg_notifications_updated_at on public.notifications;
create trigger trg_notifications_updated_at
before update on public.notifications
for each row
execute function public.set_updated_at();
