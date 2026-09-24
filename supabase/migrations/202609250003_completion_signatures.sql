-- Sign-off when a queue is closed ("ปิดงาน"): the warehouse officer and the
-- customer / driver each sign on the tablet. Signatures are PNGs in a private
-- bucket; the row keeps the object path, the signer's typed name and the time.
-- Both signatures are optional — closing the queue never blocks on them.

alter table public.bookings
  add column if not exists sign_staff_path text,
  add column if not exists sign_staff_name text,
  add column if not exists sign_customer_path text,
  add column if not exists sign_customer_name text,
  add column if not exists signed_at timestamptz;

comment on column public.bookings.sign_staff_path is 'Object path in bucket booking-signatures of the warehouse officer signature captured at close. Null = not signed.';
comment on column public.bookings.sign_staff_name is 'Typed name of the warehouse officer who signed at close.';
comment on column public.bookings.sign_customer_path is 'Object path in bucket booking-signatures of the customer / driver signature captured at close. Null = not signed.';
comment on column public.bookings.sign_customer_name is 'Typed name of the customer / driver who signed at close.';
comment on column public.bookings.signed_at is 'When the close sign-off was captured (either party).';

-- Private Storage bucket (Supabase only; skipped on plain Postgres). No storage
-- policies on purpose: the API route reads/writes with the service role after
-- checking the caller's session and shop.
do $outer$
begin
  if not exists (select 1 from pg_namespace where nspname = 'storage') then
    raise notice 'storage schema not available — booking-signatures bucket not created';
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('booking-signatures', 'booking-signatures', false, 262144, array['image/png'])
  on conflict (id) do nothing;
end
$outer$;
