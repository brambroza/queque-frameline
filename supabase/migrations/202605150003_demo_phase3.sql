alter table if exists public.demo_sandbox_sessions
  add column if not exists checklist jsonb not null default '{}'::jsonb,
  add column if not exists converted_at timestamptz,
  add column if not exists converted_by uuid references auth.users(id);

