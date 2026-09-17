insert into public.translations (namespace_id, language_code, translation_key, translation_value, active)
select n.id, 'th', 'line_onboarding', 'คู่มือตั้งค่า LINE', true
from public.translation_namespaces n
where n.code = 'menu'
on conflict (namespace_id, language_code, translation_key) do update
set translation_value = excluded.translation_value, active = excluded.active, updated_at = now();

insert into public.translations (namespace_id, language_code, translation_key, translation_value, active)
select n.id, 'en', 'line_onboarding', 'LINE Setup Guide', true
from public.translation_namespaces n
where n.code = 'menu'
on conflict (namespace_id, language_code, translation_key) do update
set translation_value = excluded.translation_value, active = excluded.active, updated_at = now();

insert into public.translations (namespace_id, language_code, translation_key, translation_value, active)
select n.id, 'th', 'rich_menu_guide', 'คู่มือ Rich Menu', true
from public.translation_namespaces n
where n.code = 'menu'
on conflict (namespace_id, language_code, translation_key) do update
set translation_value = excluded.translation_value, active = excluded.active, updated_at = now();

insert into public.translations (namespace_id, language_code, translation_key, translation_value, active)
select n.id, 'en', 'rich_menu_guide', 'Rich Menu Guide', true
from public.translation_namespaces n
where n.code = 'menu'
on conflict (namespace_id, language_code, translation_key) do update
set translation_value = excluded.translation_value, active = excluded.active, updated_at = now();

