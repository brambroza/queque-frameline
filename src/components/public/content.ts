import type { SvgIconComponent } from '@mui/icons-material';
import ContentCutRoundedIcon from '@mui/icons-material/ContentCutRounded';
import LocalHospitalRoundedIcon from '@mui/icons-material/LocalHospitalRounded';
import BackHandRoundedIcon from '@mui/icons-material/BackHandRounded';
import PhoneIphoneRoundedIcon from '@mui/icons-material/PhoneIphoneRounded';
import DirectionsCarFilledRoundedIcon from '@mui/icons-material/DirectionsCarFilledRounded';
import RestaurantRoundedIcon from '@mui/icons-material/RestaurantRounded';
import ApartmentRoundedIcon from '@mui/icons-material/ApartmentRounded';
import MeetingRoomRoundedIcon from '@mui/icons-material/MeetingRoomRounded';
import AccountBalanceRoundedIcon from '@mui/icons-material/AccountBalanceRounded';
import HealingRoundedIcon from '@mui/icons-material/HealingRounded';
import WorkspacesRoundedIcon from '@mui/icons-material/WorkspacesRounded';
import BuildRoundedIcon from '@mui/icons-material/BuildRounded';

export type UseCase = {
  icon: SvgIconComponent;
  slug: string;
  title: string;
  services: string[];
  mode: string;
  summary: string;
};

export const painPoints = [
  'ลูกค้าทักถามคิวซ้ำ ๆ',
  'พนักงานตอบแชทไม่ทัน',
  'คิวชนกันหรือจองซ้ำ',
  'จัดการหลายสาขายาก',
  'ไม่มีรายงานจำนวนคิว',
  'ลูกค้าลืมนัดหรือไม่มาตามนัด',
];

export const solutions = [
  'ลูกค้าถามคิวว่างผ่าน LINE',
  'จองคิวผ่าน LIFF',
  'ระบบตอบกลับอัตโนมัติ',
  'จัดการคิวหลังบ้าน',
  'รองรับหลายร้าน หลายสาขา',
  'รองรับคิวแบบ Fix เวลา และไม่ Fix เวลา',
  'ดูรายงานและสถิติได้',
];

export const features = [
  'LINE OA Booking',
  'LIFF Booking Page',
  'Auto Reply',
  'Booking Management',
  'Service Management',
  'Working Hours',
  'Multi-branch',
  'Staff Management',
  'Chat Inbox',
  'Calendar View',
  'Queue Board',
  'Reports',
  'Notification',
];

export const useCases: UseCase[] = [
  { icon: ContentCutRoundedIcon, slug: 'barber-shop', title: 'ร้านตัดผม', services: ['ตัดผมชาย: จองตามเวลาที่แน่นอน 30 นาที', 'ทำสีผม: เวลายืดหยุ่น 90-180 นาที'], mode: 'จองตามเวลาที่แน่นอน / เวลายืดหยุ่น', summary: 'เหมาะกับร้านที่มีทั้งงานเร็วและงานใช้เวลานาน ต้องการจัดคิวไม่ชนกัน' },
  { icon: LocalHospitalRoundedIcon, slug: 'clinic', title: 'คลินิก', services: ['ตรวจทั่วไป: จองตามเวลาที่แน่นอน 15 นาที', 'พบแพทย์เฉพาะทาง: ต้องยืนยันก่อน'], mode: 'จองตามเวลาที่แน่นอน / ต้องยืนยันก่อน', summary: 'จัดคิวตรวจทั่วไปและเคสเฉพาะทางที่ต้องอนุมัติจากทีมแพทย์' },
  { icon: BackHandRoundedIcon, slug: 'nail-salon', title: 'ร้านทำเล็บ', services: ['ทำเล็บเจล', 'ต่อเล็บ'], mode: 'จองตามเวลาที่แน่นอน', summary: 'ล็อกช่วงเวลาต่อคิวชัดเจน ลดคิวซ้อนในชั่วโมงพีค' },
  { icon: PhoneIphoneRoundedIcon, slug: 'mobile-repair', title: 'ร้านซ่อมมือถือ', services: ['เช็คอาการเครื่อง', 'ซ่อมด่วน'], mode: 'ต้องยืนยันก่อน', summary: 'รับคิวตรวจอาการก่อนซ่อมจริง และให้พนักงานยืนยันงานซ่อม' },
  { icon: DirectionsCarFilledRoundedIcon, slug: 'car-service', title: 'ร้านซ่อมรถ', services: ['เปลี่ยนยางรถ', 'เช็คระยะ'], mode: 'ต้องยืนยันก่อน', summary: 'จัดคิวงานบริการที่ต้องเช็คช่างว่างและอะไหล่ก่อนยืนยัน' },
  { icon: RestaurantRoundedIcon, slug: 'restaurant', title: 'ร้านอาหาร', services: ['จองโต๊ะ: รับจำนวนต่อรอบ', 'Walk-in: เข้ารับบริการหน้าร้าน'], mode: 'รับจำนวนต่อรอบ / Walk-in', summary: 'รองรับจองโต๊ะตามความจุและคิว walk-in หน้าร้านพร้อมกัน' },
  { icon: RestaurantRoundedIcon, slug: 'buffet', title: 'ร้านบุฟเฟ่ต์', services: ['จองรอบบุฟเฟ่ต์: รับจำนวนต่อรอบ', 'คิวหน้าร้านบุฟเฟ่ต์: Walk-in'], mode: 'รับจำนวนต่อรอบ / Walk-in', summary: 'รองรับการจองรอบเวลาและคิวหน้าร้าน พร้อมควบคุมจำนวนที่นั่งต่อรอบ' },
  { icon: MeetingRoomRoundedIcon, slug: 'meeting-room', title: 'ห้องประชุม', services: ['จองห้องประชุมรายชั่วโมง', 'จองครึ่งวัน / เต็มวัน'], mode: 'จองตามเวลาที่แน่นอน', summary: 'เหมาะกับองค์กรและ coworking ที่ต้องจัดการห้องประชุมหลายห้องหลายช่วงเวลา' },
  { icon: ApartmentRoundedIcon, slug: 'service-center', title: 'ศูนย์บริการ', services: ['รับเรื่องบริการ', 'รับคิวหน้างาน'], mode: 'จองตามเวลาที่แน่นอน', summary: 'บริหารคิวบริการหลายประเภทด้วยแดชบอร์ดเดียว' },
  { icon: AccountBalanceRoundedIcon, slug: 'government', title: 'งานราชการ', services: ['ติดต่อราชการ', 'ยื่นเอกสาร'], mode: 'ต้องยืนยันก่อน', summary: 'ลดความแออัดหน้าเคาน์เตอร์และจัดคิวตามประเภทงาน' },
  { icon: HealingRoundedIcon, slug: 'hospital', title: 'โรงพยาบาล', services: ['ตรวจทั่วไป', 'เฉพาะทาง'], mode: 'จองตามเวลาที่แน่นอน / ต้องยืนยันก่อน', summary: 'รองรับคิว OPD ทั่วไปและคิวนัดเฉพาะทางที่ต้องยืนยัน' },
  { icon: WorkspacesRoundedIcon, slug: 'consulting', title: 'Consult', services: ['ปรึกษาธุรกิจ', 'วางแผนโครงการ'], mode: 'เวลายืดหยุ่น', summary: 'กำหนดเวลานัดแบบยืดหยุ่นตามความซับซ้อนของเคส' },
  { icon: BuildRoundedIcon, slug: 'installation-team', title: 'ทีมช่างติดตั้ง', services: ['ติดตั้งกล้องวงจรปิด: ต้องยืนยันก่อน', 'ตรวจหน้างาน: เวลายืดหยุ่น'], mode: 'ต้องยืนยันก่อน / เวลายืดหยุ่น', summary: 'จัดคิวตรวจหน้างานและคิวติดตั้งจริงแบบยืดหยุ่น' },
];

/**
 * แหล่งข้อมูลราคา "ชุดเดียว" — ใช้ร่วมกันทั้งหน้า Landing (PricingPreviewSection)
 * และหน้า /pricing (PricingCard) เพื่อไม่ให้ราคาหลุดกัน
 * แก้ราคาที่นี่ที่เดียว มีผลทั้งสองหน้า
 */
export type PricingPlan = {
  /** ต้องตรงกับ subscription_plans.code ใน DB — ใช้ส่งต่อไป /register?plan=<code> */
  code: 'starter' | 'professional' | 'business' | 'enterprise';
  name: string;
  /** ราคาหลักพร้อมหน่วย เช่น '590 บาท', '0 บาท', 'ติดต่อฝ่ายขาย' */
  price: string;
  /** รอบบิล เช่น '/เดือน', '/14 วัน' — เว้นว่างสำหรับแผน Enterprise */
  period: string;
  desc: string;
  items: string[];
  highlight?: boolean;
  /** true = แผนที่ให้ผู้ใช้ติดต่อทีมขายแทนการสมัครเอง */
  contactSales?: boolean;
};

export const pricingPlans: PricingPlan[] = [
  { code: 'starter', name: 'Starter', price: 'ฟรี', period: '', desc: 'ฟรีตลอดชีพ 50 คิวต่อเดือน', items: ['50 คิว/เดือน', '1 ร้าน', '1 สาขา', '3 บริการ'] },
  { code: 'professional', name: 'Professional', price: '990 บาท', period: '/เดือน', desc: 'สำหรับร้านที่เติบโต', items: ['1 ร้าน', '5 สาขา', 'ไม่จำกัดบริการ', '2,000 bookings/เดือน', 'LINE Auto Reply'], highlight: true },
  { code: 'business', name: 'Business', price: '2,490 บาท', period: '/เดือน', desc: 'หลายสาขาและทีมใหญ่', items: ['หลายร้าน / หลายสาขา', 'ไม่จำกัดบริการ', '10,000 bookings/เดือน', 'Chat Inbox', 'Advanced Reports'] },
  { code: 'enterprise', name: 'Enterprise', price: 'ติดต่อฝ่ายขาย', period: '', desc: 'แพ็กเกจเฉพาะองค์กร', items: ['Custom features', 'Dedicated support', 'SLA', 'On-premise option'], contactSales: true },
];

/**
 * English mirror of `pricingPlans`. Prices must stay identical to the Thai list
 * and to `subscription_plans.price_monthly` — the EN page used to advertise
 * 1,490 / 3,990 for the same tiers, which contradicted both.
 */
export const pricingPlansEn: PricingPlan[] = [
  { code: 'starter', name: 'Starter', price: 'Free', period: '', desc: 'Free forever, 50 bookings a month', items: ['50 bookings/month', '1 shop', '1 branch', '3 services'] },
  { code: 'professional', name: 'Professional', price: '990 THB', period: '/month', desc: 'For growing shops', items: ['1 shop', '5 branches', 'Unlimited services', '2,000 bookings/month', 'LINE Auto Reply'], highlight: true },
  { code: 'business', name: 'Business', price: '2,490 THB', period: '/month', desc: 'Multi-branch and larger teams', items: ['Multi-shop / multi-branch', 'Unlimited services', '10,000 bookings/month', 'Chat Inbox', 'Advanced Reports'] },
  { code: 'enterprise', name: 'Enterprise', price: 'Contact sales', period: '', desc: 'Tailored for organisations', items: ['Custom features', 'Dedicated support', 'SLA', 'On-premise option'], contactSales: true },
];

export const testimonials = [
  { name: 'Narin Barber', type: 'ร้านตัดผม', quote: 'ลูกค้าจองคิวผ่าน LINE ได้เลย ลดเวลาตอบแชทหน้าร้านลงชัดเจน' },
  { name: 'Care Plus Clinic', type: 'คลินิก', quote: 'จัดการแพทย์และคิวคนไข้ได้ง่ายขึ้น ทั้งแบบนัดและขออนุมัติ' },
  { name: 'Service Hub Center', type: 'ศูนย์บริการ', quote: 'พนักงานเห็นคิวเรียลไทม์ทุกสาขา และรายงานช่วยวางกำลังคนได้ดี' },
];

export const featureCompare = [
  { key: 'จำนวนสาขา', starter: '1', pro: '5', business: 'ไม่จำกัด', enterprise: 'Custom' },
  { key: 'จำนวนบริการ', starter: '3', pro: 'ไม่จำกัด', business: 'ไม่จำกัด', enterprise: 'ไม่จำกัด' },
  { key: 'Bookings / เดือน', starter: '50', pro: '2,000', business: '10,000', enterprise: 'Custom' },
  { key: 'LINE Auto Reply', starter: '-', pro: '✓', business: '✓', enterprise: '✓' },
  { key: 'Chat Inbox', starter: '-', pro: '-', business: '✓', enterprise: '✓' },
  { key: 'SLA / Dedicated Support', starter: '-', pro: '-', business: '-', enterprise: '✓' },
];

/**
 * แสดงบนหน้าแรก /pricing และ /contact และใช้เป็น FAQPage JSON-LD ด้วย
 * ต้องมองเห็นได้จริงบนหน้าเว็บ ไม่งั้นผิดนโยบาย rich result ของ Google
 */
export const faqs = [
  { q: 'ต้องมี LINE OA ก่อนใช้งานไหม?', a: 'แนะนำให้มี LINE OA เพื่อให้ลูกค้าจองผ่านแชทได้ทันที แต่เริ่มทดลองใช้ระบบหลังบ้านก่อนได้โดยยังไม่ต้องเชื่อม LINE' },
  { q: 'รองรับหลายสาขาหรือไม่?', a: 'รองรับหลายสาขา แยกเวลาทำการ พนักงาน และคิวของแต่ละสาขาได้อิสระ' },
  { q: 'เริ่มใช้งานใช้เวลานานไหม?', a: 'หลังสมัคร ระบบจะสร้างสาขา บริการ และเวลาทำการเริ่มต้นให้อัตโนมัติ จึงรับคิวได้ทันที ส่วนการเชื่อม LINE OA ใช้เวลาประมาณ 15-30 นาที และทีมงานช่วยตั้งค่าให้ได้' },
  { q: 'แพ็กเกจฟรีใช้ได้นานแค่ไหน?', a: 'ใช้ได้ตลอด ไม่มีวันหมดอายุ จำกัดที่ 50 คิวต่อเดือน 1 สาขา และ 3 บริการ เมื่อโตเกินนี้ค่อยอัปเกรด' },
  { q: 'ชำระเงินอย่างไร และมีสัญญาผูกมัดไหม?', a: 'ไม่มีสัญญาผูกมัด ยกเลิกได้ทุกเมื่อ ชำระเป็นรายเดือนผ่านโอนธนาคารหรือ PromptPay โดยทีมงานจะออกใบแจ้งหนี้และเปิดสิทธิ์ให้หลังยืนยันการชำระ' },
  { q: 'ราคานี้รวมค่าส่งข้อความ LINE แล้วหรือยัง?', a: 'ยังไม่รวม ค่าบริการข้างต้นเป็นค่าระบบจองคิวเท่านั้น ส่วนค่าส่งข้อความคิดตามอัตราของ LINE Messaging API ซึ่งร้านชำระกับ LINE โดยตรง' },
  { q: 'ข้อมูลลูกค้าเป็นของใคร?', a: 'ข้อมูลทั้งหมดเป็นของร้าน ส่งออกเป็นไฟล์ได้ตลอดเวลา และเราจัดเก็บตามหลัก PDPA' },
  { q: 'ถ้าติดปัญหาระหว่างใช้งานติดต่อได้ทางไหน?', a: 'ติดต่อผ่าน LINE OA ของเราหรือโทรได้ในเวลาทำการ จันทร์-ศุกร์ 09:00-18:00' },
];
