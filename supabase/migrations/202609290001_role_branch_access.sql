-- Per-role branch visibility + dashboard capabilities.
--
-- A role may now be limited to some branches of the site, and carries two
-- switches: whether its members may export data, and whether they may look at
-- several branches at once on the dashboard.
--
--   roles.branch_ids   null  = every branch (default, behaviour before this file)
--                      {...} = only these branches, everywhere in the portal
--   roles.can_export   export buttons + export APIs
--   roles.multi_branch "all branches" / several branches together on the dashboard
--
-- Admin-level roles are never limited: they manage branches, staff and roles,
-- so a limit there could lock the site out of its own settings. The API layer
-- (src/lib/auth/role-capabilities.ts) applies the same rule.
--
-- A user holding several roles gets the union: any unlimited role wins.

alter table public.roles
  add column if not exists branch_ids uuid[],
  add column if not exists can_export boolean not null default true,
  add column if not exists multi_branch boolean not null default true;

comment on column public.roles.branch_ids is 'Branches members of this role may see. Null = every branch. Ignored for admin-level roles.';
comment on column public.roles.can_export is 'Members may export data (dashboard Excel/CSV). Always true for admin-level roles.';
comment on column public.roles.multi_branch is 'Members may view several branches together on the dashboard. Always true for admin-level roles.';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'roles_branch_ids_not_empty_check') then
    alter table public.roles
      add constraint roles_branch_ids_not_empty_check check (branch_ids is null or cardinality(branch_ids) > 0);
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Helpers. Security definer: they are called from policies on tables they would
-- otherwise have to read through those same policies.
-- ---------------------------------------------------------------------------

/*
 * True when the caller is limited to some branches: they hold at least one live
 * role, and every live role they hold is staff-level with a branch list.
 * No role at all = not bound here (the shop-level policy already denies them).
 */
create or replace function public.is_branch_bound(p_shop_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    exists (
      select 1
      from public.user_roles ur
      join public.roles r on r.id = ur.role_id
      where ur.user_id = auth.uid()
        and ur.is_deleted = false
        and r.is_deleted = false
        and (ur.shop_id = p_shop_id or ur.shop_id is null or p_shop_id is null)
    )
    and not exists (
      select 1
      from public.user_roles ur
      join public.roles r on r.id = ur.role_id
      where ur.user_id = auth.uid()
        and ur.is_deleted = false
        and r.is_deleted = false
        and (ur.shop_id = p_shop_id or ur.shop_id is null or p_shop_id is null)
        and (r.access_level = 'admin' or r.branch_ids is null)
    );
$$;

/* Branches the caller's roles list. Only meaningful when is_branch_bound() is true. */
create or replace function public.user_branch_ids()
returns uuid[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(distinct b), '{}'::uuid[])
  from public.user_roles ur
  join public.roles r on r.id = ur.role_id
  cross join lateral unnest(r.branch_ids) as b
  where ur.user_id = auth.uid()
    and ur.is_deleted = false
    and r.is_deleted = false
    and r.branch_ids is not null;
$$;

create or replace function public.can_access_branch(p_branch_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  -- NULL branch_id = site-wide row; the shop-level policy already governs it.
  select
    p_branch_id is null
    or not public.is_branch_bound(null)
    or p_branch_id = any (public.user_branch_ids());
$$;

revoke all on function public.is_branch_bound(uuid) from public;
grant execute on function public.is_branch_bound(uuid) to authenticated, service_role;
revoke all on function public.user_branch_ids() from public;
grant execute on function public.user_branch_ids() to authenticated, service_role;
revoke all on function public.can_access_branch(uuid) from public;
grant execute on function public.can_access_branch(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Restrictive branch policies (ANDed with the shop-level permissive policy).
-- Same guard as 202609080003: a table is only touched when it already has RLS
-- enabled and a permissive policy, otherwise a restrictive policy alone would
-- deny everything.
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
  v_column text;
  v_ready boolean;
begin
  for t, v_column in
    select * from (values
      ('branches', 'id'),
      ('working_hours', 'branch_id'),
      ('holidays', 'branch_id'),
      ('bookings', 'branch_id'),
      ('booking_resources', 'branch_id'),
      ('external_documents', 'branch_id'),
      ('notifications', 'branch_id')
    ) as x(tbl, col)
  loop
    if to_regclass(format('public.%I', t)) is null then
      continue;
    end if;

    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = t and column_name = v_column
    ) then
      raise notice 'skip %: no column %', t, v_column;
      continue;
    end if;

    select c.relrowsecurity
       and exists (select 1 from pg_policy p where p.polrelid = c.oid and p.polpermissive)
      into v_ready
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relname = t;

    if not coalesce(v_ready, false) then
      raise notice 'skip %: RLS disabled or no permissive policy — API-layer scope is the only guard', t;
      continue;
    end if;

    execute format('drop policy if exists p_%s_branch on public.%I;', t, t);
    execute format(
      'create policy p_%s_branch on public.%I as restrictive for all using (public.can_access_branch(%I)) with check (public.can_access_branch(%I));',
      t, t, v_column, v_column
    );
  end loop;
end $$;
