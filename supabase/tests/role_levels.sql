-- ============================================================
-- Smoke test for 202609300002_role_levels.sql
--
--   psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -f supabase/tests/role_levels.sql
--
-- Runs inside one transaction and ROLLS BACK: nothing is kept. Needs a
-- seeded site (1 shop, 1 vehicle type) and a connection that may create
-- auth users and switch to the `authenticated` role (postgres / service owner).
-- Any failed check raises and stops the script; the last line printed must
-- be "ALL PASSED".
--
-- What it proves: the level constraint, the seeded roles, and that a
-- viewer's own session can read but not write, while staff and manager
-- sessions still write as before.
-- ============================================================
begin;

do $$
declare
  v_company uuid; v_shop uuid;
  v_viewer uuid := gen_random_uuid();
  v_staff uuid := gen_random_uuid();
  v_manager uuid := gen_random_uuid();
  v_mixed uuid := gen_random_uuid();
  v_flag boolean; v_n int; v_id uuid; v_missing text;
  r record;
begin
  select s.company_id, s.id into v_company, v_shop from public.shops s order by s.created_at limit 1;
  if v_shop is null then raise exception 'seed data missing (need a shop)'; end if;

  -- 1. Level constraint: the four levels, nothing else.
  begin
    insert into public.roles (code, name, access_level) values ('test_bad_level', 'x', 'boss');
    raise exception 'FAIL 1: unknown access_level accepted';
  exception when check_violation then
    null;
  end;
  raise notice 'ok 1  unknown access_level refused';

  -- 2. Seeded roles carry the right level and stay inside the menus their level allows.
  for r in
    select * from (values ('wh_admin', 'staff'), ('wh_manager', 'manager'), ('director', 'viewer'), ('sales_admin', 'staff'), ('purchasing', 'staff'), ('admin', 'admin'), ('staff', 'staff')) as x(code, lvl)
  loop
    if not exists (select 1 from public.roles ro where ro.code = r.code and ro.access_level = r.lvl and not ro.is_deleted) then
      raise exception 'FAIL 2: role % is missing or not level %', r.code, r.lvl;
    end if;
  end loop;
  if exists (select 1 from public.roles ro where ro.code = 'director' and not (ro.menu_keys <@ array['dashboard', 'calendar', 'queue_board', 'reports'])) then
    raise exception 'FAIL 2: director carries a menu a viewer cannot open';
  end if;
  if exists (select 1 from public.roles ro where ro.code = 'wh_manager' and ro.menu_keys && array['staff', 'activity_logs', 'line_settings', 'api_keys', 'translations']) then
    raise exception 'FAIL 2: wh_manager carries an admin-only menu';
  end if;
  raise notice 'ok 2  seeded roles: wh_admin (staff), wh_manager (manager), director (viewer)';

  -- Four throwaway portal users: viewer, staff, manager, and one holding viewer + staff.
  insert into auth.users (id, email) values
    (v_viewer, 'role-test-viewer@example.invalid'), (v_staff, 'role-test-staff@example.invalid'),
    (v_manager, 'role-test-manager@example.invalid'), (v_mixed, 'role-test-mixed@example.invalid');
  insert into public.users_profile (id, company_id, shop_id, full_name)
  select u, v_company, v_shop, 'role test' from unnest(array[v_viewer, v_staff, v_manager, v_mixed]) u
  on conflict (id) do update set company_id = excluded.company_id, shop_id = excluded.shop_id;
  insert into public.user_roles (user_id, role_id, company_id, shop_id)
  select x.u, ro.id, v_company, v_shop
  from (values (v_viewer, 'director'), (v_staff, 'wh_admin'), (v_manager, 'wh_manager'), (v_mixed, 'director'), (v_mixed, 'wh_admin')) as x(u, code)
  join public.roles ro on ro.code = x.code;

  -- Plain Postgres has no default grants for `authenticated`; on Supabase these already exist.
  grant usage on schema public to authenticated;
  grant select, insert, update, delete on public.holidays, public.services, public.bookings, public.users_profile to authenticated;

  -- Each block below acts as one portal user: the `authenticated` role with that user's JWT
  -- subject. Both claim spellings are set so it works on Supabase and on the plain-Postgres stub.

  -- ── viewer ────────────────────────────────────────────────────────────────
  perform set_config('request.jwt.claim.sub', v_viewer::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_viewer, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  select public.is_view_only() into v_flag;
  if not v_flag then raise exception 'FAIL 3: a director is not seen as view-only'; end if;

  -- reads still work
  select count(*) into v_n from public.services;
  if v_n = 0 then raise exception 'FAIL 3: viewer cannot read vehicle types'; end if;
  perform count(*) from public.bookings;

  -- insert refused
  begin
    insert into public.holidays (company_id, shop_id, holiday_date, reason) values (v_company, v_shop, date '2099-01-01', 'viewer must not write');
    raise exception 'FAIL 3: viewer inserted a holiday';
  exception when insufficient_privilege then
    null;
  end;

  -- update / delete touch nothing
  update public.services set service_name = service_name where shop_id = v_shop;
  get diagnostics v_n = row_count;
  if v_n <> 0 then raise exception 'FAIL 3: viewer updated % vehicle types', v_n; end if;
  delete from public.services where shop_id = v_shop;
  get diagnostics v_n = row_count;
  if v_n <> 0 then raise exception 'FAIL 3: viewer deleted % vehicle types', v_n; end if;

  -- own profile stays editable
  update public.users_profile set phone = '0800000000' where id = v_viewer;
  get diagnostics v_n = row_count;
  if v_n <> 1 then raise exception 'FAIL 3: viewer cannot edit their own profile'; end if;

  execute 'reset role';
  raise notice 'ok 3  viewer session: reads, own profile; insert / update / delete refused';

  -- ── staff ─────────────────────────────────────────────────────────────────
  perform set_config('request.jwt.claim.sub', v_staff::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_staff, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select public.is_view_only() into v_flag;
  if v_flag then raise exception 'FAIL 4: staff seen as view-only'; end if;
  insert into public.holidays (company_id, shop_id, holiday_date, reason) values (v_company, v_shop, date '2099-01-02', 'staff write') returning id into v_id;
  update public.holidays set reason = 'staff edit' where id = v_id;
  get diagnostics v_n = row_count;
  if v_n <> 1 then raise exception 'FAIL 4: staff session could not update its row'; end if;
  execute 'reset role';
  raise notice 'ok 4  staff session still writes';

  -- ── manager ───────────────────────────────────────────────────────────────
  perform set_config('request.jwt.claim.sub', v_manager::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_manager, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select public.is_view_only() into v_flag;
  if v_flag then raise exception 'FAIL 5: manager seen as view-only'; end if;
  update public.services set service_name = service_name where shop_id = v_shop;
  get diagnostics v_n = row_count;
  if v_n = 0 then raise exception 'FAIL 5: manager session could not update vehicle types'; end if;
  execute 'reset role';
  raise notice 'ok 5  manager session writes the warehouse set-up';

  -- ── viewer + staff ────────────────────────────────────────────────────────
  perform set_config('request.jwt.claim.sub', v_mixed::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_mixed, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select public.is_view_only() into v_flag;
  if v_flag then raise exception 'FAIL 6: a user who also holds a working role is view-only'; end if;
  insert into public.holidays (company_id, shop_id, holiday_date, reason) values (v_company, v_shop, date '2099-01-03', 'mixed write');
  execute 'reset role';
  raise notice 'ok 6  viewer role next to a working role is not view-only';

  -- 7. Every table a portal session can write is covered, bar the two left open on purpose.
  select string_agg(c.relname, ', ' order by c.relname) into v_missing
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
     and c.relname not in ('users_profile', 'feedback_reports')
     and exists (select 1 from pg_policy p where p.polrelid = c.oid and p.polpermissive)
     and (select count(*) from pg_policy p where p.polrelid = c.oid and not p.polpermissive and p.polname like 'p\_%\_viewer\_%') < 3;
  if v_missing is not null then raise exception 'FAIL 7: tables without the viewer write guard: %', v_missing; end if;
  raise notice 'ok 7  every writable table carries the viewer write guard';

  raise notice 'ALL PASSED';
end $$;

rollback;
