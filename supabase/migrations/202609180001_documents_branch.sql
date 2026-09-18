-- Multi-branch: every SO / PO belongs to the branch (warehouse) that fulfils it,
-- so the self-booking link only offers that branch's docks and hours.
-- branches.code lets CSV / ERP imports name the branch by a short code.

alter table public.branches
  add column if not exists code text;

create unique index if not exists branches_shop_code_uidx
  on public.branches (shop_id, code)
  where code is not null and is_deleted = false;

alter table public.external_documents
  add column if not exists branch_id uuid references public.branches(id);

create index if not exists external_documents_branch_idx
  on public.external_documents (shop_id, branch_id);

comment on column public.external_documents.branch_id is 'Branch / warehouse the goods are picked up from or delivered to; null = site default (first active branch)';

-- Docks belong to a branch. Backfill any dock without one to the first active branch of its site.
update public.booking_resources r
   set branch_id = b.id
  from (
    select distinct on (shop_id) id, shop_id
      from public.branches
     where is_deleted = false and active = true
     order by shop_id, created_at
  ) b
 where r.shop_id = b.shop_id
   and r.resource_type = 'dock'
   and r.branch_id is null;

update public.branches set code = 'HQ' where id = '30000000-0000-4000-8000-000000000001' and code is null;
