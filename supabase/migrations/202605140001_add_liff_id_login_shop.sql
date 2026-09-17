alter table public.shops
  add column if not exists liff_id_login_shop text;

comment on column public.shops.liff_id_login_shop is
  'LIFF ID for member/account login flow per shop';
