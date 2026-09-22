-- Fix: the user_roles write policy calls has_access_level(), which reads
-- user_roles itself, so every session query on user_roles recursed through RLS
-- ("stack depth limit exceeded") and the portal showed no menus to anyone.
-- The helpers now run as security definer (RLS bypassed inside them), the
-- standard Supabase pattern for role checks used inside policies.

create or replace function public.has_access_level(p_level text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid()
      and r.access_level = p_level
      and ur.is_deleted = false
      and r.is_deleted = false
  );
$$;

create or replace function public.has_role(p_role text)
returns boolean
language sql
stable
security definer
set search_path = public
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

revoke all on function public.has_access_level(text) from public;
grant execute on function public.has_access_level(text) to authenticated, service_role;
revoke all on function public.has_role(text) from public;
grant execute on function public.has_role(text) to authenticated, service_role;
