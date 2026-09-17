create or replace function public.has_role(p_role text)
returns boolean
language sql
stable
as $$
  select exists(
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid()
      and r.code = p_role
      and ur.is_deleted = false
  );
$$;

create or replace function public.can_access_shop(p_shop_id uuid)
returns boolean
language sql
stable
as $$
  select
    public.has_role('super_admin')
    or exists(
      select 1 from public.users_profile up
      where up.id = auth.uid() and up.shop_id = p_shop_id and up.is_deleted = false
    )
    or exists(
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid() and ur.shop_id = p_shop_id and ur.is_deleted = false
    );
$$;

create or replace function public.can_access_branch(p_branch_id uuid)
returns boolean
language sql
stable
as $$
  select
    public.has_role('super_admin')
    or exists(
      select 1 from public.branches b
      join public.users_profile up on up.shop_id = b.shop_id and up.id = auth.uid()
      where b.id = p_branch_id and b.is_deleted = false and up.is_deleted = false
    )
    or exists(
      select 1 from public.staff s
      join public.staff_branches sb on sb.staff_id = s.id and sb.branch_id = p_branch_id and sb.is_deleted = false
      where s.user_id = auth.uid() and s.is_deleted = false
    );
$$;

DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(array[
    'companies','shops','branches','users_profile','roles','permissions','user_roles','staff','staff_branches',
    'customers','line_users','service_categories','services','working_hours','holidays','queue_slots','bookings',
    'booking_logs','line_messages','notifications','activity_logs','settings'
  ])
  LOOP
    EXECUTE format('alter table public.%s enable row level security;', t);
  END LOOP;
END$$;

create policy if not exists p_companies_rw on public.companies
for all using (
  public.has_role('super_admin') or exists(select 1 from public.users_profile up where up.id = auth.uid() and up.company_id = companies.id)
) with check (
  public.has_role('super_admin') or exists(select 1 from public.users_profile up where up.id = auth.uid() and up.company_id = companies.id)
);

DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(array[
    'shops','branches','staff','staff_branches','customers','line_users','service_categories','services','working_hours',
    'holidays','queue_slots','bookings','booking_logs','line_messages','notifications','activity_logs','settings'
  ])
  LOOP
    EXECUTE format('drop policy if exists p_%s_rw on public.%s;', t, t);
    EXECUTE format('create policy p_%s_rw on public.%s for all using (public.can_access_shop(shop_id)) with check (public.can_access_shop(shop_id));', t, t);
  END LOOP;
END$$;

drop policy if exists p_users_profile_rw on public.users_profile;
create policy p_users_profile_rw on public.users_profile
for all using (
  auth.uid() = id or public.has_role('super_admin') or public.can_access_shop(shop_id)
) with check (
  auth.uid() = id or public.has_role('super_admin') or public.can_access_shop(shop_id)
);

drop policy if exists p_roles_read on public.roles;
create policy p_roles_read on public.roles
for select using (auth.uid() is not null);

drop policy if exists p_permissions_read on public.permissions;
create policy p_permissions_read on public.permissions
for select using (auth.uid() is not null);

drop policy if exists p_user_roles_rw on public.user_roles;
create policy p_user_roles_rw on public.user_roles
for all using (
  public.has_role('super_admin') or user_id = auth.uid() or public.can_access_shop(shop_id)
) with check (
  public.has_role('super_admin') or public.can_access_shop(shop_id)
);
