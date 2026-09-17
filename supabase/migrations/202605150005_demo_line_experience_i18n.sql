with ns as (
  select id from public.translation_namespaces where code = 'demo'
),
seed(lang, k, v) as (
  values
  ('th','line_chat','จำลองแชท LINE'),
  ('en','line_chat','LINE Chat'),
  ('th','rich_menu','เมนู Rich Menu'),
  ('en','rich_menu','Rich Menu'),
  ('th','booking_success','จองสำเร็จ'),
  ('en','booking_success','Booking Success'),
  ('th','queue_called','ถึงคิวของคุณแล้วค่ะ'),
  ('en','queue_called','Your queue is being called'),
  ('th','open_liff','เปิด LIFF'),
  ('en','open_liff','Open LIFF'),
  ('th','check_booking','เช็กคิว'),
  ('en','check_booking','Check Booking'),
  ('th','member_profile','ข้อมูลสมาชิก'),
  ('en','member_profile','Member Profile'),
  ('th','promotions','โปรโมชั่น'),
  ('en','promotions','Promotions')
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
select n.id, 'th', 'demo_line_experience', 'จำลอง LINE + LIFF', true
from public.translation_namespaces n
where n.code = 'menu'
on conflict (namespace_id, language_code, translation_key) do update
set translation_value = excluded.translation_value, active = excluded.active, updated_at = now();

insert into public.translations (namespace_id, language_code, translation_key, translation_value, active)
select n.id, 'en', 'demo_line_experience', 'LINE + LIFF Demo', true
from public.translation_namespaces n
where n.code = 'menu'
on conflict (namespace_id, language_code, translation_key) do update
set translation_value = excluded.translation_value, active = excluded.active, updated_at = now();
