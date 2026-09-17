-- Rich Menu master template generator.
-- Adds the shop's normalized business type (drives the default template) and
-- the persisted rich menu config / image / published LINE rich menu id.
-- business_type has no CHECK on purpose: values are validated by zod
-- (src/lib/line/rich-menu/business-types.ts), same approach as demo_business_type.

alter table public.shops
  add column if not exists business_type text,
  add column if not exists rich_menu_config jsonb,
  add column if not exists rich_menu_image_url text,
  add column if not exists line_rich_menu_id text,
  add column if not exists rich_menu_published_at timestamptz;

comment on column public.shops.business_type is 'Normalized business type key (salon, clinic, restaurant, ...). Null = not chosen yet.';
comment on column public.shops.rich_menu_config is 'RichMenuConfig JSON (version 1) used to regenerate the rich menu image and LINE areas.';
comment on column public.shops.rich_menu_image_url is 'Public URL of the last rich menu image saved to the shop-assets bucket.';
comment on column public.shops.line_rich_menu_id is 'richMenuId returned by LINE for the menu this system published. Null = not published via the system.';
comment on column public.shops.rich_menu_published_at is 'When line_rich_menu_id was last published.';

-- Backfill from the demo sandbox type where no business type was chosen.
update public.shops
set business_type = case demo_business_type
  when 'barber' then 'salon'
  when 'clinic' then 'clinic'
  when 'restaurant' then 'restaurant'
  when 'buffet' then 'buffet'
  when 'meeting_room' then 'meeting_room'
  else null
end
where business_type is null
  and demo_business_type is not null;
