create table if not exists public.languages (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  native_name text,
  is_default boolean not null default false,
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.translation_namespaces (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.translations (
  id uuid primary key default gen_random_uuid(),
  namespace_id uuid not null references public.translation_namespaces(id) on delete cascade,
  language_code text not null references public.languages(code) on update cascade,
  translation_key text not null,
  translation_value text not null,
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  unique(namespace_id, language_code, translation_key)
);

create index if not exists idx_translations_language_code on public.translations(language_code);
create index if not exists idx_translations_key on public.translations(translation_key);
create index if not exists idx_translations_namespace on public.translations(namespace_id);
create index if not exists idx_translations_active on public.translations(active);

alter table public.shops add column if not exists default_language text not null default 'th';
alter table public.line_users add column if not exists preferred_language text not null default 'th';

do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where table_schema = 'public' and table_name = 'shops' and constraint_name = 'shops_default_language_fk'
  ) then
    alter table public.shops
      add constraint shops_default_language_fk foreign key (default_language) references public.languages(code);
  end if;
exception when undefined_table then
  null;
end$$;

do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where table_schema = 'public' and table_name = 'line_users' and constraint_name = 'line_users_preferred_language_fk'
  ) then
    alter table public.line_users
      add constraint line_users_preferred_language_fk foreign key (preferred_language) references public.languages(code);
  end if;
exception when undefined_table then
  null;
end$$;

drop trigger if exists trg_languages_updated_at on public.languages;
create trigger trg_languages_updated_at before update on public.languages
for each row execute function public.set_updated_at();

drop trigger if exists trg_translation_namespaces_updated_at on public.translation_namespaces;
create trigger trg_translation_namespaces_updated_at before update on public.translation_namespaces
for each row execute function public.set_updated_at();

drop trigger if exists trg_translations_updated_at on public.translations;
create trigger trg_translations_updated_at before update on public.translations
for each row execute function public.set_updated_at();

create or replace function public.i18n_is_admin_or_owner()
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
      and ur.is_deleted = false
      and r.is_deleted = false
      and r.code in ('super_admin', 'shop_owner')
  );
$$;

alter table public.languages enable row level security;
alter table public.translation_namespaces enable row level security;
alter table public.translations enable row level security;

drop policy if exists languages_read_all on public.languages;
create policy languages_read_all on public.languages
for select to anon, authenticated
using (active = true);

drop policy if exists languages_manage_admin on public.languages;
create policy languages_manage_admin on public.languages
for all to authenticated
using (public.i18n_is_admin_or_owner())
with check (public.i18n_is_admin_or_owner());

drop policy if exists namespaces_read_all on public.translation_namespaces;
create policy namespaces_read_all on public.translation_namespaces
for select to anon, authenticated
using (active = true);

drop policy if exists namespaces_manage_admin on public.translation_namespaces;
create policy namespaces_manage_admin on public.translation_namespaces
for all to authenticated
using (public.i18n_is_admin_or_owner())
with check (public.i18n_is_admin_or_owner());

drop policy if exists translations_read_all on public.translations;
create policy translations_read_all on public.translations
for select to anon, authenticated
using (active = true);

drop policy if exists translations_manage_admin on public.translations;
create policy translations_manage_admin on public.translations
for all to authenticated
using (public.i18n_is_admin_or_owner())
with check (public.i18n_is_admin_or_owner());
