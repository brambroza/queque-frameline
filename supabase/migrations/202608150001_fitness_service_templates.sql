-- Fitness business preset: seed service templates for category "fitness"

insert into public.service_templates (
  business_category,
  service_name,
  booking_mode,
  duration_minutes,
  min_duration_minutes,
  max_duration_minutes,
  capacity_per_slot,
  requires_approval,
  allow_walk_in,
  default_duration_minutes,
  default_capacity_per_slot,
  sort_order
)
select v.business_category,
       v.service_name,
       v.booking_mode,
       v.duration_minutes,
       v.min_duration_minutes,
       v.max_duration_minutes,
       v.capacity_per_slot,
       v.requires_approval,
       v.allow_walk_in,
       v.default_duration_minutes,
       v.default_capacity_per_slot,
       v.sort_order
from (values
  ('fitness', 'คลาสกลุ่ม (Group Class)', 'capacity_based', 60, null::int, null::int, 20, false, false, 60, 20, 250),
  ('fitness', 'โยคะ', 'capacity_based', 60, null::int, null::int, 15, false, false, 60, 15, 260),
  ('fitness', 'เทรนเนอร์ส่วนตัว (Personal Trainer)', 'fixed_slot', 60, null::int, null::int, 1, false, false, 60, 1, 270),
  ('fitness', 'ประเมินร่างกาย / Body Assessment', 'fixed_slot', 30, null::int, null::int, 1, false, false, 30, 1, 280),
  ('fitness', 'ใช้ยิมรายวัน (Day Pass)', 'walk_in', null::int, null::int, null::int, 50, false, true, null::int, 50, 290),
  ('fitness', 'ทดลองเล่นฟรี (Free Trial)', 'request_approval', null::int, 30, 90, 1, true, false, null::int, 1, 300)
) as v(
  business_category,
  service_name,
  booking_mode,
  duration_minutes,
  min_duration_minutes,
  max_duration_minutes,
  capacity_per_slot,
  requires_approval,
  allow_walk_in,
  default_duration_minutes,
  default_capacity_per_slot,
  sort_order
)
where not exists (
  select 1
  from public.service_templates t
  where t.business_category = v.business_category
    and t.service_name = v.service_name
);
