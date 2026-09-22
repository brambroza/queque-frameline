-- Suggested dock time from the document's item lines.
--
-- When a document (SO / PO) carries item lines, the approve dialog suggests
-- dock time = number of lines x site_settings.minutes_per_item (quantity per line
-- is ignored). Without lines the vehicle type's duration stays the suggestion.
-- This is a suggestion on approval only: slot generation and create_dock_booking
-- still use services.duration_minutes.

-- ---------------------------------------------------------------------------
-- Settings
-- ---------------------------------------------------------------------------
alter table public.site_settings
  add column if not exists item_minutes_enabled boolean not null default true,
  add column if not exists minutes_per_item int not null default 10;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'site_settings_minutes_per_item_range') then
    alter table public.site_settings
      add constraint site_settings_minutes_per_item_range check (minutes_per_item between 1 and 240);
  end if;
end $$;

comment on column public.site_settings.item_minutes_enabled is 'Suggest dock time from the document item lines when approving a queue.';
comment on column public.site_settings.minutes_per_item is 'Minutes per item line (quantity ignored). Suggested dock time = lines x this.';

-- ---------------------------------------------------------------------------
-- Line count, so booking lists do not have to pull the whole items array
-- ---------------------------------------------------------------------------
alter table public.external_documents
  add column if not exists item_count int
    generated always as (case when jsonb_typeof(items) = 'array' then jsonb_array_length(items) else 0 end) stored;

comment on column public.external_documents.item_count is 'Number of item lines in items (generated).';
