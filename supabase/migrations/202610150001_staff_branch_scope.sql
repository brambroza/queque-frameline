-- Per-staff branch assignment narrows branch scope.
--
-- /portal/staff lets an admin tick "สาขาที่รับผิดชอบ" per staff member
-- (public.staff_branches), but 202609290001 derived the branch scope from
-- roles.branch_ids alone, so the per-person list had no effect: a staff member
-- assigned to one branch still saw every branch of the site.
--
-- From here on (mirrors applyStaffBranches() in src/lib/auth/role-capabilities.ts):
--   - admin-level callers are never limited (unchanged)
--   - a role without a branch list + staff assignment  = the assigned branches
--   - a role with a branch list    + staff assignment  = the intersection
--   - no staff assignment                               = the role scope (unchanged)
-- Only live rows count (staff.is_deleted / staff_branches.is_deleted = false).

/* Branches assigned to the caller as a staff member. Empty = no assignment. */
create or replace function public.staff_branch_ids()
returns uuid[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(distinct sb.branch_id), '{}'::uuid[])
  from public.staff s
  join public.staff_branches sb on sb.staff_id = s.id and sb.is_deleted = false
  where s.user_id = auth.uid()
    and s.is_deleted = false;
$$;

/*
 * True when the caller is limited to some branches: they hold at least one live
 * role, are not admin-level, and either every role carries a branch list or they
 * have a per-staff assignment.
 */
create or replace function public.is_branch_bound(p_shop_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with live as (
    select r.access_level, r.branch_ids
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid()
      and ur.is_deleted = false
      and r.is_deleted = false
      and (ur.shop_id = p_shop_id or ur.shop_id is null or p_shop_id is null)
  )
  select exists (select 1 from live)
     and not exists (select 1 from live where access_level = 'admin')
     and (
       not exists (select 1 from live where branch_ids is null)
       or cardinality(public.staff_branch_ids()) > 0
     );
$$;

/* Effective branch list of a bound caller: role list ∩ staff assignment (either side may be absent). */
create or replace function public.user_branch_ids()
returns uuid[]
language sql
stable
security definer
set search_path = public
as $$
  with role_ids as (
    select array_agg(distinct b) as ids, bool_or(r.branch_ids is null) as unlimited
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    left join lateral unnest(r.branch_ids) as b on true
    where ur.user_id = auth.uid()
      and ur.is_deleted = false
      and r.is_deleted = false
  ),
  staff_ids as (select public.staff_branch_ids() as ids)
  select case
    when coalesce(si.ids, '{}'::uuid[]) = '{}'::uuid[] then coalesce(ri.ids, '{}'::uuid[])
    when coalesce(ri.unlimited, true) then si.ids
    else coalesce((select array_agg(x) from unnest(si.ids) as x where x = any (ri.ids)), '{}'::uuid[])
  end
  from staff_ids si
  left join role_ids ri on true;
$$;

revoke all on function public.staff_branch_ids() from public;
grant execute on function public.staff_branch_ids() to authenticated, service_role;
revoke all on function public.is_branch_bound(uuid) from public;
grant execute on function public.is_branch_bound(uuid) to authenticated, service_role;
revoke all on function public.user_branch_ids() from public;
grant execute on function public.user_branch_ids() to authenticated, service_role;

create index if not exists staff_branches_staff_live_idx
  on public.staff_branches (staff_id, branch_id) where is_deleted = false;
