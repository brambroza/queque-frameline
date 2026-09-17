-- Customer acknowledgement of a shop-initiated booking change (moved slot or
-- reassigned provider). `change_notified_at` is stamped when the LINE notice
-- is pushed; `change_acknowledged_at` when the customer taps "รับทราบ" in LINE
-- or in the LIFF account tab. Ack is pending while notified_at is newer.
alter table public.bookings
  add column if not exists change_notified_at timestamptz,
  add column if not exists change_acknowledged_at timestamptz;

comment on column public.bookings.change_notified_at is 'Last time the customer was pushed a LINE notice about a shop-initiated change';
comment on column public.bookings.change_acknowledged_at is 'Last time the customer acknowledged a shop-initiated change';
