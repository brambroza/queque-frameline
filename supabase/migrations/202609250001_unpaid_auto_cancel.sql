-- Auto-cancel of unpaid customer queues.
--
-- A customer books through their link on an SO that is still unpaid: the queue
-- is held as `pending` (payment gate, 202609210001). With this feature the
-- warehouse can put a clock on that hold: unless the payment is recorded within
-- `unpaid_cancel_minutes` (counted from the booking, capped at the appointment
-- time), the cron sweep cancels the queue and frees the slot. One warning goes
-- to the customer `unpaid_warn_minutes` before the deadline (LINE + banner on
-- the booking page), stamped in `bookings.payment_warned_at` so it is never
-- repeated. Only queues from the customer link are swept; queues staff created
-- by hand are left alone.

alter table public.site_settings
  add column if not exists unpaid_cancel_enabled boolean not null default false,
  add column if not exists unpaid_cancel_minutes int not null default 60,
  add column if not exists unpaid_warn_minutes int not null default 15;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'site_settings_unpaid_cancel_range') then
    alter table public.site_settings
      add constraint site_settings_unpaid_cancel_range check (
        unpaid_cancel_minutes between 5 and 10080
        and unpaid_warn_minutes between 0 and 240
        and unpaid_warn_minutes < unpaid_cancel_minutes
      );
  end if;
end $$;

comment on column public.site_settings.unpaid_cancel_enabled is 'Cancel a customer-link queue on an unpaid SO automatically when the payment is not recorded in time.';
comment on column public.site_settings.unpaid_cancel_minutes is 'Minutes from the booking (or from the last payment change) before an unpaid queue is cancelled; never later than the appointment time.';
comment on column public.site_settings.unpaid_warn_minutes is 'Minutes before that deadline to warn the customer once. 0 = no warning.';

alter table public.bookings
  add column if not exists payment_warned_at timestamptz;

comment on column public.bookings.payment_warned_at is 'When the customer was warned that the unpaid queue is about to be cancelled (once per booking). Null = not yet.';

-- The sweep reads pending queues of the site each minute.
create index if not exists bookings_pending_sweep_idx
  on public.bookings (shop_id, created_at)
  where status = 'pending' and is_deleted = false;

/*
 * Cancel one pending queue because its SO is still unpaid — atomically.
 *
 * The cron decided from a snapshot that the deadline passed; between that read
 * and this call the warehouse may have recorded the payment. So the queue row
 * is locked first, then the document is read again under a share lock (which
 * also blocks a concurrent payment PATCH until this transaction ends) and the
 * queue is cancelled only if the SO is still unpaid at that moment.
 *
 * Returns true when the queue was cancelled by this call, false when nothing
 * was done (already moved on, or paid in the meantime).
 */
create or replace function public.cancel_unpaid_booking(p_shop_id uuid, p_booking_id uuid, p_reason text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_b public.bookings%rowtype;
  v_doc_id uuid;
begin
  select * into v_b from public.bookings b
   where b.id = p_booking_id and b.shop_id = p_shop_id and b.status = 'pending' and b.is_deleted = false
     and b.booking_source = 'customer_link'
   for update;
  if not found then
    return false;
  end if;
  if v_b.document_id is null then
    return false;
  end if;

  -- Fresh read of the document under a share lock: a payment committed after
  -- the cron's snapshot is seen here, and one in flight waits for us.
  select d.id into v_doc_id from public.external_documents d
   where d.id = v_b.document_id and d.doc_type = 'so' and d.payment_status = 'unpaid' and d.is_deleted = false
   for share;
  if not found then
    return false;
  end if;

  update public.bookings
     set status = 'cancelled',
         cancel_reason = coalesce(nullif(trim(p_reason), ''), 'ไม่ได้ชำระเงินภายในเวลาที่กำหนด — ระบบยกเลิกอัตโนมัติ'),
         cancelled_by = null
   where id = v_b.id;
  return true;
end;
$$;

revoke all on function public.cancel_unpaid_booking(uuid, uuid, text) from public;
grant execute on function public.cancel_unpaid_booking(uuid, uuid, text) to service_role;
