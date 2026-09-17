-- Fix RLS access for resource-related tables in multi-tenant setup.
-- Ensures policy function exists and maps current auth user to shop scope.

create or replace function public.can_access_shop(p_shop_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    exists (
      select 1
      from public.users_profile up
      where up.id = auth.uid()
        and up.shop_id = p_shop_id
        and coalesce(up.is_deleted, false) = false
    )
    or exists (
      select 1
      from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.shop_id = p_shop_id
        and coalesce(ur.is_deleted, false) = false
    )
    or exists (
      select 1
      from public.user_roles ur
      join public.roles r on r.id = ur.role_id
      where ur.user_id = auth.uid()
        and coalesce(ur.is_deleted, false) = false
        and coalesce(r.is_deleted, false) = false
        and r.code = 'super_admin'
    );
$$;

grant execute on function public.can_access_shop(uuid) to authenticated;

alter table if exists public.booking_resources enable row level security;
alter table if exists public.booking_resource_assignments enable row level security;
alter table if exists public.signage_settings enable row level security;

drop policy if exists p_booking_resources_rw on public.booking_resources;
create policy p_booking_resources_rw
on public.booking_resources
for all
to authenticated
using (public.can_access_shop(shop_id))
with check (public.can_access_shop(shop_id));

drop policy if exists p_booking_resource_assignments_rw on public.booking_resource_assignments;
create policy p_booking_resource_assignments_rw
on public.booking_resource_assignments
for all
to authenticated
using (public.can_access_shop(shop_id))
with check (public.can_access_shop(shop_id));

drop policy if exists p_signage_settings_rw on public.signage_settings;
create policy p_signage_settings_rw
on public.signage_settings
for all
to authenticated
using (public.can_access_shop(shop_id))
with check (public.can_access_shop(shop_id));

grant select, insert, update, delete on table public.booking_resources to authenticated;
grant select, insert, update, delete on table public.booking_resource_assignments to authenticated;
grant select, insert, update, delete on table public.signage_settings to authenticated;
