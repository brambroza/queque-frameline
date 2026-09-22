-- Admin-managed roles with per-role menu visibility.
--
-- A role has an access level (the API tier every route already checks:
-- 'admin' | 'staff') and an optional list of portal menu keys. Null menu_keys
-- means "every menu the level allows". Custom roles ("gate", "finance", ...)
-- are created from the staff screen; 'admin' and 'staff' are system roles that
-- cannot be deleted. Route guards keep checking the level, so a custom role can
-- never reach an API its level does not allow.

-- ---------------------------------------------------------------------------
-- roles
-- ---------------------------------------------------------------------------
alter table public.roles
  add column if not exists access_level text not null default 'staff',
  add column if not exists menu_keys text[],
  add column if not exists description text,
  add column if not exists sort_order int not null default 0,
  add column if not exists is_system boolean not null default false;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'roles_access_level_check') then
    alter table public.roles
      add constraint roles_access_level_check check (access_level in ('admin', 'staff'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'roles_code_format_check') then
    alter table public.roles
      add constraint roles_code_format_check check (code ~ '^[a-z][a-z0-9_]{1,31}$');
  end if;
end $$;

update public.roles set access_level = 'admin', is_system = true, sort_order = 0, description = coalesce(description, 'เห็นทุกเมนู จัดการระบบทั้งหมด')
 where code = 'admin';
update public.roles set access_level = 'staff', is_system = true, sort_order = 1, description = coalesce(description, 'งานหน้าคลัง: คิว เอกสาร บอร์ด')
 where code = 'staff';

comment on column public.roles.access_level is 'API tier the role grants: admin | staff. Route guards check this, not the role code.';
comment on column public.roles.menu_keys is 'Portal menu keys this role may open. Null = every menu its access level allows.';
comment on column public.roles.is_system is 'Built-in role (admin, staff): cannot be deleted or change its level.';

-- ---------------------------------------------------------------------------
-- Access-level helper for RLS + i18n admin check
-- ---------------------------------------------------------------------------
create or replace function public.has_access_level(p_level text)
returns boolean
language sql
stable
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

create or replace function public.i18n_is_admin_or_owner()
returns boolean
language sql
stable
as $$
  select public.has_access_level('admin');
$$;

-- user_roles: anyone in the shop may read grants; only admin-level users may write.
-- Before this the write policy let any shop user grant themselves 'admin'.
drop policy if exists p_user_roles_rw on public.user_roles;
drop policy if exists p_user_roles_read on public.user_roles;
drop policy if exists p_user_roles_write on public.user_roles;

create policy p_user_roles_read on public.user_roles
for select using (user_id = auth.uid() or public.can_access_shop(shop_id));

create policy p_user_roles_write on public.user_roles
for all using (public.has_access_level('admin') and public.can_access_shop(shop_id))
with check (public.has_access_level('admin') and public.can_access_shop(shop_id));

create index if not exists user_roles_user_active_idx on public.user_roles (user_id) where is_deleted = false;
