-- Customer nickname (ชื่อเล่น): set by the customer in LIFF or by staff in the
-- portal. Used to call queues by a name people actually answer to, and shown in
-- full on the queue display in place of the (possibly masked) real name.
alter table public.customers
  add column if not exists nickname text;

alter table public.customers
  drop constraint if exists customers_nickname_len;

alter table public.customers
  add constraint customers_nickname_len
  check (nickname is null or char_length(nickname) <= 100);

comment on column public.customers.nickname is
  'ชื่อเล่นที่ลูกค้าตั้งเอง (สูงสุด 100 ตัวอักษร) ใช้เรียกคิวและแสดงเต็มบนจอคิวแทนชื่อจริง';
