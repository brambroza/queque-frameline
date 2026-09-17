-- Branch-scoped access: indexes to support resolving a user's allowed branches
-- and filtering every branch-aware table by that set.
--
-- No new columns: the user -> branch link reuses staff + staff_branches.

-- Collapse any pre-existing duplicate assignments so the unique index can be built.
update public.staff_branches sb
set is_deleted = true,
    updated_at = now()
where sb.is_deleted = false
  and exists (
    select 1
    from public.staff_branches keep
    where keep.staff_id = sb.staff_id
      and keep.branch_id = sb.branch_id
      and keep.is_deleted = false
      and (keep.created_at, keep.id) < (sb.created_at, sb.id)
  );

create unique index if not exists uq_staff_branches_active
  on public.staff_branches (staff_id, branch_id)
  where is_deleted = false;

-- auth.uid() -> staff row lookup, run on most authenticated requests.
create index if not exists idx_staff_user_shop
  on public.staff (shop_id, user_id)
  where is_deleted = false;

-- staff row -> allowed branch ids.
create index if not exists idx_staff_branches_lookup
  on public.staff_branches (shop_id, staff_id)
  where is_deleted = false;

-- bookings had no branch_id index; branch-scoped list/report queries need it.
create index if not exists idx_bookings_shop_branch_date
  on public.bookings (shop_id, branch_id, booking_date);
