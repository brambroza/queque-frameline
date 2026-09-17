insert into public.translation_namespaces (code, name, description, active, sort_order)
values ('notification', 'Notifications', 'Notification translations', true, 30)
on conflict (code) do update
set name = excluded.name,
    description = excluded.description,
    active = excluded.active,
    sort_order = excluded.sort_order;

with ns as (
  select id from public.translation_namespaces where code = 'notification'
),
seed(lang, k, v) as (
  values
  ('th','title','การแจ้งเตือน'),
  ('en','title','Notifications'),
  ('th','empty','ไม่มีการแจ้งเตือน'),
  ('en','empty','No notifications'),
  ('th','mark_all_read','อ่านทั้งหมด'),
  ('en','mark_all_read','Mark all read'),
  ('th','view_all','ดูทั้งหมด'),
  ('en','view_all','View all'),
  ('th','read','อ่านแล้ว'),
  ('en','read','Read'),
  ('th','archive','เก็บถาวร'),
  ('en','archive','Archive'),
  ('th','filter_all','ทั้งหมด'),
  ('en','filter_all','All'),
  ('th','filter_unread','ยังไม่อ่าน'),
  ('en','filter_unread','Unread'),
  ('th','priority.low','ต่ำ'),
  ('en','priority.low','Low'),
  ('th','priority.medium','กลาง'),
  ('en','priority.medium','Medium'),
  ('th','priority.high','สูง'),
  ('en','priority.high','High'),
  ('th','priority.critical','วิกฤต'),
  ('en','priority.critical','Critical'),
  ('th','category.bookings','การจอง'),
  ('en','category.bookings','Bookings'),
  ('th','category.operations','ปฏิบัติการ'),
  ('en','category.operations','Operations'),
  ('th','category.customers','ลูกค้า'),
  ('en','category.customers','Customers'),
  ('th','category.billing','บิลลิ่ง'),
  ('en','category.billing','Billing'),
  ('th','category.system','ระบบ'),
  ('en','category.system','System'),
  ('th','category.marketing','การตลาด'),
  ('en','category.marketing','Marketing')
)
insert into public.translations (namespace_id, language_code, translation_key, translation_value, active)
select ns.id, seed.lang, seed.k, seed.v, true
from seed
cross join ns
on conflict (namespace_id, language_code, translation_key) do update
set translation_value = excluded.translation_value,
    active = excluded.active,
    updated_at = now();

insert into public.translations (namespace_id, language_code, translation_key, translation_value, active)
select n.id, 'th', 'notifications', 'การแจ้งเตือน', true
from public.translation_namespaces n
where n.code = 'menu'
on conflict (namespace_id, language_code, translation_key) do update
set translation_value = excluded.translation_value, active = excluded.active, updated_at = now();

insert into public.translations (namespace_id, language_code, translation_key, translation_value, active)
select n.id, 'en', 'notifications', 'Notifications', true
from public.translation_namespaces n
where n.code = 'menu'
on conflict (namespace_id, language_code, translation_key) do update
set translation_value = excluded.translation_value, active = excluded.active, updated_at = now();
