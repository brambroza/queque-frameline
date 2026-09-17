-- WARNING:
-- This file opens broad CRUD access and is intended for development/debug only.
-- Do NOT use in production.

-- 1) Ensure RLS is enabled (policies below will allow access)
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

-- 2) Drop existing policies to avoid conflicts
DO $$
DECLARE t text;
DECLARE p record;
BEGIN
  FOR t IN SELECT unnest(array[
    'companies','shops','branches','users_profile','roles','permissions','user_roles','staff','staff_branches',
    'customers','line_users','service_categories','services','working_hours','holidays','queue_slots','bookings',
    'booking_logs','line_messages','notifications','activity_logs','settings'
  ])
  LOOP
    FOR p IN
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'public' AND tablename = t
    LOOP
      EXECUTE format('drop policy if exists %I on public.%I;', p.policyname, t);
    END LOOP;
  END LOOP;
END$$;

-- 3) Open policy: authenticated users can CRUD everything
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(array[
    'companies','shops','branches','users_profile','roles','permissions','user_roles','staff','staff_branches',
    'customers','line_users','service_categories','services','working_hours','holidays','queue_slots','bookings',
    'booking_logs','line_messages','notifications','activity_logs','settings'
  ])
  LOOP
    EXECUTE format(
      'create policy p_%s_all_auth on public.%s for all to authenticated using (true) with check (true);',
      t, t
    );
  END LOOP;
END$$;

-- 4) Optional: allow anon as well (uncomment if needed)
-- DO $$
-- DECLARE t text;
-- BEGIN
--   FOR t IN SELECT unnest(array[
--     'companies','shops','branches','users_profile','roles','permissions','user_roles','staff','staff_branches',
--     'customers','line_users','service_categories','services','working_hours','holidays','queue_slots','bookings',
--     'booking_logs','line_messages','notifications','activity_logs','settings'
--   ])
--   LOOP
--     EXECUTE format(
--       'create policy p_%s_all_anon on public.%s for all to anon using (true) with check (true);',
--       t, t
--     );
--   END LOOP;
-- END$$;
