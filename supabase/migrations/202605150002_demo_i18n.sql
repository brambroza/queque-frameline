insert into public.translation_namespaces (code, name, description, active, sort_order)
values ('demo', 'Demo Sandbox', 'Demo sandbox translations', true, 20)
on conflict (code) do update
set name = excluded.name,
    description = excluded.description,
    active = excluded.active,
    sort_order = excluded.sort_order;

with ns as (
  select id from public.translation_namespaces where code = 'demo'
),
seed(lang, k, v) as (
  values
  ('th','title','โหมดทดลองใช้งาน'),
  ('en','title','Demo Sandbox'),
  ('th','banner','คุณกำลังใช้งานโหมดตัวอย่าง ข้อมูลนี้ใช้สำหรับทดลองเท่านั้น'),
  ('en','banner','You are using Demo Mode. This data is for testing only.'),
  ('th','create_sample','สร้างข้อมูลตัวอย่าง'),
  ('en','create_sample','Create Sample Data'),
  ('th','reset','รีเซ็ตข้อมูลตัวอย่าง'),
  ('en','reset','Reset Demo Data'),
  ('th','connect_line','เชื่อม LINE OA เพื่อใช้งานจริง'),
  ('en','connect_line','Connect LINE OA to Go Live'),
  ('th','try_call_queue','ทดลองเรียกคิว'),
  ('en','try_call_queue','Try Call Queue'),
  ('th','open_signage','เปิดหน้าจอแสดงคิว'),
  ('en','open_signage','Open Digital Signage'),
  ('th','mock_line','จำลองแชท LINE'),
  ('en','mock_line','Mock LINE Chat'),
  ('th','convert_to_real','ใช้ข้อมูลนี้ต่อเป็นข้อมูลจริง'),
  ('en','convert_to_real','Convert Demo Data to Real')
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
select n.id, 'th', 'demo_sandbox', 'โหมดทดลอง', true
from public.translation_namespaces n
where n.code = 'menu'
on conflict (namespace_id, language_code, translation_key) do update
set translation_value = excluded.translation_value, active = excluded.active, updated_at = now();

insert into public.translations (namespace_id, language_code, translation_key, translation_value, active)
select n.id, 'en', 'demo_sandbox', 'Demo Sandbox', true
from public.translation_namespaces n
where n.code = 'menu'
on conflict (namespace_id, language_code, translation_key) do update
set translation_value = excluded.translation_value, active = excluded.active, updated_at = now();
