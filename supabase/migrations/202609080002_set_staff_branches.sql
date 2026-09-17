-- Replace a staff member's branch assignments in one transaction.
--
-- The route used to soft-delete every row and then insert the new set. When the
-- insert failed the staff member was left with zero branches — harmless before,
-- but with branch-scoped access it silently locks them out of all data.

create or replace function public.set_staff_branches(
  p_staff_id uuid,
  p_shop_id uuid,
  p_branch_ids uuid[],
  p_actor uuid
) returns void
language plpgsql
as $$
declare
  v_branch_ids uuid[] := coalesce(p_branch_ids, '{}'::uuid[]);
  v_company_id uuid;
begin
  select company_id into v_company_id
  from public.staff
  where id = p_staff_id and shop_id = p_shop_id and is_deleted = false;

  if v_company_id is null then
    raise exception 'staff % not found in shop %', p_staff_id, p_shop_id;
  end if;

  -- Every branch must belong to this shop; otherwise the assignment would grant
  -- access across tenants.
  if exists (
    select 1
    from unnest(v_branch_ids) as b(branch_id)
    where not exists (
      select 1 from public.branches br
      where br.id = b.branch_id and br.shop_id = p_shop_id and br.is_deleted = false
    )
  ) then
    raise exception 'branch list contains an id outside shop %', p_shop_id;
  end if;

  update public.staff_branches
     set is_deleted = true, updated_by = p_actor, updated_at = now()
   where staff_id = p_staff_id
     and shop_id = p_shop_id
     and is_deleted = false
     and not (branch_id = any (v_branch_ids));

  insert into public.staff_branches (company_id, shop_id, staff_id, branch_id, created_by, updated_by)
  select v_company_id, p_shop_id, p_staff_id, b.branch_id, p_actor, p_actor
    from unnest(v_branch_ids) as b(branch_id)
   where not exists (
     select 1 from public.staff_branches sb
      where sb.staff_id = p_staff_id
        and sb.branch_id = b.branch_id
        and sb.is_deleted = false
   );
end;
$$;

grant execute on function public.set_staff_branches(uuid, uuid, uuid[], uuid) to authenticated;
