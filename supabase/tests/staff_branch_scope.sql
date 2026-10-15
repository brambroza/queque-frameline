-- ============================================================
-- Smoke test for 202610150001_staff_branch_scope.sql
--
--   psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -f supabase/tests/staff_branch_scope.sql
--
-- Runs inside one transaction and ROLLS BACK: nothing is kept. Needs a seeded
-- site (1 shop, ≥ 1 branch) and a connection that may create auth users and
-- switch to the `authenticated` role. The last line printed must be "ALL PASSED".
--
-- What it proves: a per-staff branch assignment (staff_branches) narrows what a
-- session can see through RLS, even when the role itself is unlimited; the
-- role list and the staff list intersect; admins stay unlimited.
-- ============================================================
begin;

do $$
declare
  v_company uuid; v_shop uuid;
  v_hq uuid; v_b2 uuid; v_b3 uuid;
  v_role_open uuid; v_role_b23 uuid; v_role_admin uuid;
  v_u_open uuid := gen_random_uuid();     -- unlimited role, staff pinned to b2
  v_u_inter uuid := gen_random_uuid();    -- role {b2,b3}, staff pinned to {hq,b3} → b3
  v_u_free uuid := gen_random_uuid();     -- unlimited role, no staff row → everything
  v_u_admin uuid := gen_random_uuid();    -- admin, staff pinned to b2 → everything
  v_staff_id uuid;
  v_n int; v_flag boolean; v_ids uuid[];
begin
  select s.company_id, s.id into v_company, v_shop from public.shops s order by s.created_at limit 1;
  if v_shop is null then raise exception 'seed data missing (need a shop)'; end if;
  select id into v_hq from public.branches where shop_id = v_shop and is_deleted = false order by created_at limit 1;
  if v_hq is null then raise exception 'seed data missing (need a branch)'; end if;

  insert into public.branches (company_id, shop_id, branch_name, code, open_time, close_time, max_parallel_queues)
  values (v_company, v_shop, 'scope test B2', 'SB2', time '08:00', time '17:00', 1) returning id into v_b2;
  insert into public.branches (company_id, shop_id, branch_name, code, open_time, close_time, max_parallel_queues)
  values (v_company, v_shop, 'scope test B3', 'SB3', time '08:00', time '17:00', 1) returning id into v_b3;

  insert into public.roles (code, name, access_level) values ('scope_open', 'open', 'staff') returning id into v_role_open;
  insert into public.roles (code, name, access_level, branch_ids) values ('scope_b23', 'b23', 'staff', array[v_b2, v_b3]) returning id into v_role_b23;
  select id into v_role_admin from public.roles where code = 'admin' and is_deleted = false limit 1;

  insert into auth.users (id, email) values
    (v_u_open, 'scope-open@example.invalid'), (v_u_inter, 'scope-inter@example.invalid'),
    (v_u_free, 'scope-free@example.invalid'), (v_u_admin, 'scope-admin@example.invalid');
  insert into public.users_profile (id, company_id, shop_id, full_name)
  select u, v_company, v_shop, 'scope test' from unnest(array[v_u_open, v_u_inter, v_u_free, v_u_admin]) u
  on conflict (id) do update set company_id = excluded.company_id, shop_id = excluded.shop_id;
  insert into public.user_roles (user_id, role_id, company_id, shop_id) values
    (v_u_open, v_role_open, v_company, v_shop), (v_u_inter, v_role_b23, v_company, v_shop),
    (v_u_free, v_role_open, v_company, v_shop), (v_u_admin, v_role_admin, v_company, v_shop);

  -- staff rows + assignments through the same RPC the portal uses
  insert into public.staff (user_id, company_id, shop_id, display_name) values (v_u_open, v_company, v_shop, 'open') returning id into v_staff_id;
  perform public.set_staff_branches(v_staff_id, v_shop, array[v_b2], v_u_admin);
  insert into public.staff (user_id, company_id, shop_id, display_name) values (v_u_inter, v_company, v_shop, 'inter') returning id into v_staff_id;
  perform public.set_staff_branches(v_staff_id, v_shop, array[v_hq, v_b3], v_u_admin);
  insert into public.staff (user_id, company_id, shop_id, display_name) values (v_u_admin, v_company, v_shop, 'admin') returning id into v_staff_id;
  perform public.set_staff_branches(v_staff_id, v_shop, array[v_b2], v_u_admin);

  -- one SO per branch + one site-wide SO
  insert into public.external_documents (company_id, shop_id, doc_type, doc_no, branch_id, status, source, items) values
    (v_company, v_shop, 'so', 'SCOPE-HQ', v_hq, 'open', 'manual', '[]'),
    (v_company, v_shop, 'so', 'SCOPE-B2', v_b2, 'open', 'manual', '[]'),
    (v_company, v_shop, 'so', 'SCOPE-B3', v_b3, 'open', 'manual', '[]'),
    (v_company, v_shop, 'so', 'SCOPE-ALL', null, 'open', 'manual', '[]');

  grant usage on schema public to authenticated;
  grant select on public.external_documents, public.branches to authenticated;

  -- ── 1. unlimited role + staff pinned to B2 → only B2 (+ site-wide rows) ──
  perform set_config('request.jwt.claim.sub', v_u_open::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_u_open, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select public.is_branch_bound(null) into v_flag;
  if not v_flag then raise exception 'FAIL 1: staff assignment did not bind the caller'; end if;
  select public.user_branch_ids() into v_ids;
  if v_ids <> array[v_b2] then raise exception 'FAIL 1: expected {b2}, got %', v_ids; end if;
  select count(*) into v_n from public.branches where id in (v_hq, v_b2, v_b3);
  if v_n <> 1 then raise exception 'FAIL 1: sees % branches, expected 1', v_n; end if;
  select count(*) into v_n from public.external_documents where doc_no like 'SCOPE-%';
  if v_n <> 2 then raise exception 'FAIL 1: sees % documents, expected 2 (B2 + site-wide)', v_n; end if;
  if not exists (select 1 from public.external_documents where doc_no = 'SCOPE-B2') then raise exception 'FAIL 1: cannot see own branch document'; end if;
  execute 'reset role';
  raise notice 'ok 1  unlimited role + staff pinned to one branch: sees that branch only';

  -- ── 2. role {B2,B3} + staff {HQ,B3} → intersection = B3 ──
  perform set_config('request.jwt.claim.sub', v_u_inter::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_u_inter, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select public.user_branch_ids() into v_ids;
  if v_ids <> array[v_b3] then raise exception 'FAIL 2: expected {b3}, got %', v_ids; end if;
  select count(*) into v_n from public.branches where id in (v_hq, v_b2, v_b3);
  if v_n <> 1 then raise exception 'FAIL 2: sees % branches, expected 1', v_n; end if;
  if exists (select 1 from public.external_documents where doc_no in ('SCOPE-HQ', 'SCOPE-B2')) then raise exception 'FAIL 2: sees a branch outside the intersection'; end if;
  if not exists (select 1 from public.external_documents where doc_no = 'SCOPE-B3') then raise exception 'FAIL 2: cannot see B3'; end if;
  execute 'reset role';
  raise notice 'ok 2  role list ∩ staff list';

  -- ── 3. unlimited role, no staff assignment → everything (unchanged behaviour) ──
  perform set_config('request.jwt.claim.sub', v_u_free::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_u_free, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select public.is_branch_bound(null) into v_flag;
  if v_flag then raise exception 'FAIL 3: caller without assignment is bound'; end if;
  select count(*) into v_n from public.branches where id in (v_hq, v_b2, v_b3);
  if v_n <> 3 then raise exception 'FAIL 3: sees % branches, expected 3', v_n; end if;
  execute 'reset role';
  raise notice 'ok 3  no assignment: role scope stands';

  -- ── 4. admin + staff pinned to B2 → still everything ──
  perform set_config('request.jwt.claim.sub', v_u_admin::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_u_admin, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select public.is_branch_bound(null) into v_flag;
  if v_flag then raise exception 'FAIL 4: admin became branch-bound'; end if;
  select count(*) into v_n from public.external_documents where doc_no like 'SCOPE-%';
  if v_n <> 4 then raise exception 'FAIL 4: admin sees % documents, expected 4', v_n; end if;
  execute 'reset role';
  raise notice 'ok 4  admin never limited';

  -- ── 5. soft-deleted assignment no longer counts ──
  update public.staff_branches set is_deleted = true where staff_id = (select id from public.staff where user_id = v_u_open);
  perform set_config('request.jwt.claim.sub', v_u_open::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_u_open, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select public.is_branch_bound(null) into v_flag;
  if v_flag then raise exception 'FAIL 5: deleted assignment still binds'; end if;
  execute 'reset role';
  raise notice 'ok 5  removing the assignment lifts the limit';

  raise notice 'ALL PASSED';
end $$;

rollback;
