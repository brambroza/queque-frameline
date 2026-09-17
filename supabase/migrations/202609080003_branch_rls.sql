-- Enforce branch scope at the database as a second line of defence behind the
-- API-layer checks in src/lib/auth/branch-scope.ts.
--
-- Before this, can_access_branch() existed in supabase/rls.sql but no policy ever
-- called it, and its first branch granted every branch of a shop to anyone whose
-- profile pointed at that shop — so it would not have constrained anyone.

-- supabase/rls.sql is applied by hand and may not have been run on a given database,
-- so define the helper this migration depends on rather than assuming it exists.
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

/*
 * True only for users who are actually bound to branches inside this shop:
 * someone holding branch_manager or staff there and nothing wider.
 *
 * Phrasing it this way (rather than "is an owner") keeps legacy owner accounts —
 * which may have no user_roles row at all — from being locked out of their own data.
 */
create or replace function public.is_branch_bound(p_shop_id uuid)
returns boolean
language sql
stable
as $$
  select
    not public.has_role('super_admin')
    and not exists (
      select 1
      from public.user_roles ur
      join public.roles r on r.id = ur.role_id
      where ur.user_id = auth.uid()
        and ur.is_deleted = false
        and r.code = 'shop_owner'
        and (ur.shop_id = p_shop_id or ur.shop_id is null)
    )
    and not exists (
      select 1 from public.shops s
      where s.id = p_shop_id and s.created_by = auth.uid() and s.is_deleted = false
    )
    and exists (
      select 1
      from public.user_roles ur
      join public.roles r on r.id = ur.role_id
      where ur.user_id = auth.uid()
        and ur.is_deleted = false
        and ur.shop_id = p_shop_id
        and r.code in ('branch_manager', 'staff')
    );
$$;

create or replace function public.can_access_branch(p_branch_id uuid)
returns boolean
language sql
stable
as $$
  -- NULL branch_id = shop-wide row; the shop-level policy already governs it.
  select
    p_branch_id is null
    or not exists (
      select 1 from public.branches b
      where b.id = p_branch_id and public.is_branch_bound(b.shop_id)
    )
    or exists (
      select 1
      from public.staff s
      join public.staff_branches sb
        on sb.staff_id = s.id
       and sb.branch_id = p_branch_id
       and sb.is_deleted = false
      where s.user_id = auth.uid() and s.is_deleted = false
    );
$$;

/*
 * RESTRICTIVE is essential here: PostgreSQL ORs permissive policies together, so a
 * second permissive policy would widen access instead of narrowing it. Restrictive
 * policies are ANDed with the existing shop-level p_<table>_rw policy.
 *
 * A restrictive policy with no permissive policy beside it denies everything, so a
 * table is only touched when it already has RLS enabled AND a permissive policy.
 * On a database where supabase/rls.sql was never applied this simply skips, and the
 * API-layer scope in src/lib/auth/branch-scope.ts remains the enforcement point.
 */
DO $$
DECLARE
  t text;
  v_column text;
  v_ready boolean;
BEGIN
  FOR t, v_column IN
    SELECT * FROM (VALUES
      ('branches', 'id'),
      ('staff_branches', 'branch_id'),
      ('working_hours', 'branch_id'),
      ('holidays', 'branch_id'),
      ('queue_slots', 'branch_id'),
      ('bookings', 'branch_id'),
      ('booking_resources', 'branch_id'),
      ('booking_resource_assignments', 'branch_id'),
      ('signage_settings', 'branch_id'),
      ('notifications', 'branch_id')
    ) AS x(tbl, col)
  LOOP
    IF to_regclass(format('public.%I', t)) IS NULL THEN
      CONTINUE;
    END IF;

    SELECT c.relrowsecurity
       AND EXISTS (
             SELECT 1 FROM pg_policy p
             WHERE p.polrelid = c.oid AND p.polpermissive
           )
      INTO v_ready
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relname = t;

    IF NOT coalesce(v_ready, false) THEN
      RAISE NOTICE 'skip %: RLS disabled or no permissive policy — apply supabase/rls.sql first', t;
      CONTINUE;
    END IF;

    EXECUTE format('drop policy if exists p_%s_branch on public.%I;', t, t);
    EXECUTE format(
      'create policy p_%s_branch on public.%I as restrictive for all using (public.can_access_branch(%I)) with check (public.can_access_branch(%I));',
      t, t, v_column, v_column
    );
  END LOOP;
END$$;
