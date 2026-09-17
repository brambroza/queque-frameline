-- Digital signage display modes: template / layout / extra toggles on signage_settings.
--
-- The table already carries theme, name masking, limits and refresh interval, but
-- nothing in the app reads it yet. This migration adds the columns the new signage
-- designer needs and pins the free-text columns to the ids used in
-- src/lib/signage/types.ts.

alter table if exists public.signage_settings
  add column if not exists template text not null default 'classic',
  add column if not exists layout text not null default 'landscape',
  add column if not exists show_clock boolean not null default true,
  add column if not exists show_qr boolean not null default false;

-- Legacy palette ids -> new ids. Only 'dark' was ever written (demo seeding).
update public.signage_settings set theme = 'emerald' where theme in ('dark', 'default', '');
alter table public.signage_settings alter column theme set default 'emerald';

alter table public.signage_settings drop constraint if exists signage_settings_template_check;
alter table public.signage_settings add constraint signage_settings_template_check
  check (template in ('classic', 'spotlight', 'counter', 'board', 'minimal'));

alter table public.signage_settings drop constraint if exists signage_settings_layout_check;
alter table public.signage_settings add constraint signage_settings_layout_check
  check (layout in ('landscape', 'portrait'));

alter table public.signage_settings drop constraint if exists signage_settings_theme_check;
alter table public.signage_settings add constraint signage_settings_theme_check
  check (theme in ('emerald', 'midnight', 'restaurant', 'clinic', 'meeting', 'nail', 'light'));

alter table public.signage_settings drop constraint if exists signage_settings_limits_check;
alter table public.signage_settings add constraint signage_settings_limits_check
  check (
    next_queue_limit between 1 and 10
    and waiting_queue_limit between 0 and 20
    and refresh_seconds between 5 and 120
  );

-- The existing partial unique index treats NULL branch_id as distinct, so a shop
-- could end up with several shop-wide rows. Coalesce NULL to a sentinel to block that.
create unique index if not exists idx_signage_settings_unique_scope_coalesced
  on public.signage_settings (shop_id, coalesce(branch_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where is_deleted = false;

comment on column public.signage_settings.template is 'Signage layout template id (see src/lib/signage/types.ts)';
comment on column public.signage_settings.layout is 'Screen orientation: landscape (16:9) or portrait (9:16)';
comment on column public.signage_settings.show_clock is 'Show live clock in the signage header';
comment on column public.signage_settings.show_qr is 'Show LIFF booking QR code on the signage';
