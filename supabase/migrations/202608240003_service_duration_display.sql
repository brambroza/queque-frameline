-- Per-shop toggle for showing service duration on the LIFF booking page.
--
-- `services.duration_minutes` drives slot generation, so it always has a value,
-- but for many shops it is an internal scheduling number rather than a promise
-- to the customer — a 30-minute slot is not a guarantee the visit takes 30
-- minutes. Those shops want the number kept out of the customer-facing page.
--
-- Opt-out per shop. Default on: shops that never touch the setting keep the
-- current behaviour.

alter table shops
  add column if not exists show_service_duration boolean not null default true;

comment on column shops.show_service_duration is
  'When true, the LIFF booking page shows each service duration in minutes (service cards, summary card, service dropdown).';
