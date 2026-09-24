-- LINE rich menu for customers / suppliers / drivers (2026-09-24).
--
-- The portal publishes one rich menu through the Messaging API (create →
-- upload image → set as default). LINE only returns an id, so the id and the
-- publish time are kept here to replace / remove the menu later. The menu's
-- buttons are postbacks answered by the webhook ("คิวของฉัน", "สถานะ SO",
-- "ติดต่อคลัง"), which looks the LINE user up through the existing bindings
-- (customers.line_user_id, bookings.line_user_id, bookings.driver_line_user_id).

alter table public.line_config
  add column if not exists rich_menu_id text,
  add column if not exists rich_menu_published_at timestamptz;

comment on column public.line_config.rich_menu_id is 'richMenuId returned by LINE for the menu this system published. Null = none published via the system.';
comment on column public.line_config.rich_menu_published_at is 'When rich_menu_id was last published (created + image uploaded + set as default).';

-- Lookups the webhook does per button press: LINE user → partner / bookings.
create index if not exists customers_line_user_idx on public.customers (line_user_id) where line_user_id is not null;
create index if not exists bookings_line_user_idx on public.bookings (line_user_id) where line_user_id is not null;
