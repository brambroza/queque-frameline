-- Guard against double-booking a single resource (trainer, chair, room).
--
-- find_available_resources() answers "which resources of this type are free?",
-- which is the wrong question when the customer already picked a specific
-- person. This function answers "is THIS resource free?" so the booking write
-- paths can reject an explicit resource_id that is already taken.
--
-- The overlap logic mirrors find_available_resources (202605160001) on purpose,
-- including the guard for legacy rows whose end_time is not after start_time.

create or replace function public.is_resource_available(
  p_shop_id uuid,
  p_resource_id uuid,
  p_start timestamptz,
  p_end timestamptz,
  p_exclude_booking_id uuid default null
)
returns boolean
language sql
stable
as $$
  select not exists (
    select 1
    from public.bookings b
    cross join lateral (
      select
        (b.booking_date::text || ' ' || b.start_time::text || '+07')::timestamptz as b_start_ts,
        (b.booking_date::text || ' ' || coalesce(b.end_time, b.start_time + interval '30 minutes')::text || '+07')::timestamptz as b_end_raw_ts
    ) t
    where b.shop_id = p_shop_id
      and b.resource_id = p_resource_id
      and b.is_deleted = false
      and b.status not in ('cancelled','no_show','skipped','completed')
      and (p_exclude_booking_id is null or b.id <> p_exclude_booking_id)
      and tstzrange(
        t.b_start_ts,
        case when t.b_end_raw_ts > t.b_start_ts then t.b_end_raw_ts else t.b_start_ts + interval '1 minute' end,
        '[)'
      ) && tstzrange(
        p_start,
        case when p_end > p_start then p_end else p_start + interval '1 minute' end,
        '[)'
      )
  );
$$;

create index if not exists idx_bookings_resource_date
  on public.bookings(resource_id, booking_date)
  where is_deleted = false;
