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
  sort_order
) values
-- ร้านตัดผม
('ร้านตัดผม', 'ตัดผมชาย', 'fixed_slot', 30, null, null, 1, false, false, 10),
('ร้านตัดผม', 'ทำสีผม', 'flexible_duration', null, 90, 180, 1, false, false, 20),
-- คลินิก
('คลินิก', 'ตรวจทั่วไป', 'fixed_slot', 15, null, null, 1, false, false, 30),
('คลินิก', 'พบแพทย์เฉพาะทาง', 'request_approval', null, null, null, 1, true, false, 40),
-- ร้านอาหาร
('ร้านอาหาร', 'จองโต๊ะ', 'capacity_based', null, null, null, 4, false, false, 50),
('ร้านอาหาร', 'Walk-in', 'walk_in', null, null, null, 1, false, true, 60),
-- ทีมช่างติดตั้ง
('ทีมช่างติดตั้ง', 'ติดตั้งกล้องวงจรปิด', 'request_approval', null, null, null, 1, true, false, 70),
('ทีมช่างติดตั้ง', 'ตรวจหน้างาน', 'flexible_duration', null, 60, 180, 1, false, false, 80),
-- Seed list requested
('ร้านตัดผม', 'ตัดผมชาย', 'fixed_slot', 30, null, null, 1, false, false, 90),
('ร้านทำเล็บ', 'ทำเล็บ', 'fixed_slot', 60, null, null, 1, false, false, 100),
('คลินิก', 'ตรวจทั่วไป', 'fixed_slot', 15, null, null, 1, false, false, 110),
('ร้านซ่อมมือถือ', 'ซ่อมมือถือ', 'request_approval', null, null, null, 1, true, false, 120),
('ร้านซ่อมรถ', 'เปลี่ยนยางรถ', 'request_approval', null, null, null, 1, true, false, 130),
('ร้านอาหาร', 'จองโต๊ะ', 'capacity_based', null, null, null, 4, false, false, 140),
('งานราชการ', 'ติดต่อราชการ', 'request_approval', null, null, null, 1, true, false, 150),
('Consult', 'ปรึกษาธุรกิจ', 'flexible_duration', null, 30, 120, 1, false, false, 160),
('ทีมช่างติดตั้ง', 'ติดตั้งอินเทอร์เน็ต', 'request_approval', null, null, null, 1, true, false, 170)
on conflict do nothing;

-- Restaurant / Buffet / Meeting Room templates
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
) values
('restaurant', 'จองโต๊ะ', 'capacity_based', 90, null, null, 10, false, false, 90, 10, 180),
('restaurant', 'Walk-in ร้านอาหาร', 'walk_in', null, null, null, 20, false, true, null, 20, 190),
('buffet', 'จองรอบบุฟเฟ่ต์', 'capacity_based', 120, null, null, 50, false, false, 120, 50, 200),
('buffet', 'คิวหน้าร้านบุฟเฟ่ต์', 'walk_in', 120, null, null, 50, false, true, 120, 50, 210),
('meeting_room', 'จองห้องประชุม', 'fixed_slot', 60, null, null, 1, false, false, 60, 1, 220),
('meeting_room', 'จองห้องประชุมครึ่งวัน', 'fixed_slot', 240, null, null, 1, false, false, 240, 1, 230),
('meeting_room', 'จองห้องประชุมเต็มวัน', 'fixed_slot', 480, null, null, 1, false, false, 480, 1, 240),
('fitness', 'คลาสกลุ่ม (Group Class)', 'capacity_based', 60, null, null, 20, false, false, 60, 20, 250),
('fitness', 'โยคะ', 'capacity_based', 60, null, null, 15, false, false, 60, 15, 260),
('fitness', 'เทรนเนอร์ส่วนตัว (Personal Trainer)', 'fixed_slot', 60, null, null, 1, false, false, 60, 1, 270),
('fitness', 'ประเมินร่างกาย / Body Assessment', 'fixed_slot', 30, null, null, 1, false, false, 30, 1, 280),
('fitness', 'ใช้ยิมรายวัน (Day Pass)', 'walk_in', null, null, null, 50, false, true, null, 50, 290),
('fitness', 'ทดลองเล่นฟรี (Free Trial)', 'request_approval', null, 30, 90, 1, true, false, null, 1, 300)
on conflict do nothing;
