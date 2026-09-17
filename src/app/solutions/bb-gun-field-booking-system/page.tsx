import type { Metadata } from 'next';
import GpsFixedRoundedIcon from '@mui/icons-material/GpsFixedRounded';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import TimerRoundedIcon from '@mui/icons-material/TimerRounded';
import PaymentsRoundedIcon from '@mui/icons-material/PaymentsRounded';
import StorefrontRoundedIcon from '@mui/icons-material/StorefrontRounded';
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded';
import NotificationsActiveRoundedIcon from '@mui/icons-material/NotificationsActiveRounded';
import InsightsRoundedIcon from '@mui/icons-material/InsightsRounded';
import Inventory2RoundedIcon from '@mui/icons-material/Inventory2Rounded';
import BusinessCenterRoundedIcon from '@mui/icons-material/BusinessCenterRounded';
import { SolutionPage, type SolutionPageContent } from '@/components/public/solution-page';

const path = '/solutions/bb-gun-field-booking-system';
const title = 'ระบบจองสนาม BB Gun ผ่าน LINE OA | จองรอบเกม ทีม และอุปกรณ์เช่า | QueueBooking';
const description =
  'ระบบจองสนาม BB Gun และสนาม airsoft ผ่าน LINE OA ให้หัวหน้าทีมจองรอบเกม ระบุจำนวนผู้เล่น เลือกอุปกรณ์เช่า และวางมัดจำ PromptPay ได้เอง รอบไม่เกินความจุ เตรียมอุปกรณ์ทันก่อนวันเล่น';

export const metadata: Metadata = {
  title,
  description,
  keywords: [
    'ระบบจองสนาม BB Gun',
    'จองสนามบีบีกันผ่าน LINE',
    'ระบบจองสนาม airsoft',
    'ระบบจองรอบเกม',
    'จองสนาม BB Gun ออนไลน์',
    'ระบบจองสนามเพนท์บอล',
    'ระบบจัดการสนามยิงปืนอัดลม',
    'จองสนามเป็นทีมผ่าน LINE',
  ],
  alternates: { canonical: path, languages: { 'th-TH': path, 'x-default': path } },
  openGraph: { title, description, url: path, type: 'website', locale: 'th_TH' },
};

const content: SolutionPageContent = {
  path,
  badge: 'BB Gun & Airsoft Field Booking Platform',
  heroTitle: 'ให้ทีมผู้เล่นจองรอบเกมสนาม BB Gun ผ่าน LINE พร้อมจำนวนคนและอุปกรณ์เช่าล่วงหน้า',
  heroSubtitle:
    'หัวหน้าทีมเลือกวัน เลือกรอบ ระบุจำนวนผู้เล่น เลือกปืนและชุดเซฟตี้ที่ต้องเช่า แล้ววางมัดจำ PromptPay ได้ในแชท LINE สนามเห็นสรุปต่อรอบล่วงหน้า รอบไม่เกินความจุ และทีมมาจริงตามจอง',
  heroPills: ['จองเป็นรอบเกม', 'จำกัดจำนวนผู้เล่นต่อรอบ', 'เลือกอุปกรณ์เช่า', 'มัดจำต่อทีม'],
  whyTitle: 'ทำไมสนาม BB Gun ถึงควรใช้ QueueBooking',
  whyItems: ['รอบเต็มแสดงอัตโนมัติ', 'รู้จำนวนอุปกรณ์เช่าล่วงหน้า', 'มัดจำต่อทีมลดทีมหาย', 'เหมาสนามปิดรอบจากหลังบ้าน'],
  painTitle: 'สนามของคุณกำลังเจอปัญหาเหล่านี้หรือไม่?',
  painPoints: [
    'สองทีมจองรอบเดียวกันเกินความจุสนาม',
    'ไม่รู้ต้องเตรียมปืนเช่าและชุดเซฟตี้กี่ชุด',
    'จองรอบวันหยุดแล้วทีมหายไม่มา',
    'ชื่อทีม จำนวนคน และเบอร์กระจายหลายห้องแชท',
    'พนักงานตอบ "รอบนี้เต็มไหม" ซ้ำทั้งวัน',
    'ลูกค้ากลุ่มบริษัทขอเหมาสนามแต่ปิดรอบไม่ทัน',
  ],
  featuresTitle: 'ระบบจองสนาม BB Gun ผ่าน LINE แบบครบวงจร',
  solutionFeatures: [
    'จองรอบเกมผ่าน LINE OA',
    'รอบแบบรับจำนวนต่อรอบ',
    'ระบุจำนวนผู้เล่นตอนจอง',
    'อุปกรณ์เช่าเป็นบริการเสริม',
    'มัดจำ PromptPay ต่อทีม',
    'ข้อความยืนยันพร้อมกติกาและแผนที่',
    'แจ้งเตือนก่อนวันเล่น',
    'เหมาสนาม / ปิดรอบจากหลังบ้าน',
    'รายงานรอบและอุปกรณ์ที่ใช้',
  ],
  stepsTitle: 'หัวหน้าทีมจองได้ใน 6 ขั้นตอน',
  steps: ['เพิ่มเพื่อน LINE OA ของสนาม', 'กดเมนู "จองรอบเกม"', 'เลือกวันและรอบที่ยังว่าง', 'ระบุจำนวนผู้เล่นและอุปกรณ์เช่า', 'ชำระมัดจำ PromptPay', 'รับข้อความยืนยันพร้อมกติกาและเวลารายงานตัว'],
  useCasesTitle: 'ตัวอย่างการใช้งานสำหรับสนามแต่ละแบบ',
  useCases: [
    { title: 'สนาม BB Gun รอบมาตรฐาน', desc: 'เปิดรอบเช้า บ่าย และเย็นวันหยุด กำหนดผู้เล่นสูงสุดต่อรอบ เต็มแล้วปิดรับอัตโนมัติ.', icon: GpsFixedRoundedIcon },
    { title: 'สนาม airsoft / paintball', desc: 'รอบยาว 2 ถึง 3 ชั่วโมง มีผู้เล่นขั้นต่ำต่อรอบ ระบบรวมทีมเล็กเข้ารอบเดียวกันให้เห็นล่วงหน้า.', icon: TimerRoundedIcon },
    { title: 'สนามที่มีอุปกรณ์ให้เช่า', desc: 'ปืน ชุดเซฟตี้ และลูกกระสุนเป็นบริการเสริม สนามเห็นจำนวนที่ต้องเตรียมต่อรอบตั้งแต่คืนก่อน.', icon: Inventory2RoundedIcon },
    { title: 'งานเหมาสนาม / team building', desc: 'สร้างการจองแบบปิดรอบจากหลังบ้าน รอบนั้นไม่แสดงว่างให้ทีมอื่นจอง.', icon: BusinessCenterRoundedIcon },
    { title: 'ทีมประจำ', desc: 'ทีมที่มาเล่นทุกสัปดาห์ให้พนักงานล็อกรอบล่วงหน้าทั้งเดือน.', icon: GroupsRoundedIcon },
    { title: 'สนามที่รับมัดจำ', desc: 'บังคับมัดจำต่อทีมก่อนยืนยันรอบ ตั้งกติกาคืนเงินตามนโยบายสนาม.', icon: PaymentsRoundedIcon },
    { title: 'สนามหลายแห่ง', desc: 'ดูรอบทุกสนามในหลังบ้านเดียว แยกรายงานและพนักงานตามสนาม.', icon: StorefrontRoundedIcon },
    { title: 'สนามที่ต้องการรายงาน', desc: 'ดูว่ารอบไหนวันไหนขายดี อุปกรณ์ชนิดไหนถูกเช่ามากสุด เพื่อเปิดรอบเพิ่มหรือซื้ออุปกรณ์ให้พอ.', icon: InsightsRoundedIcon },
  ],
  benefitsTitle: 'ประโยชน์ที่สนาม BB Gun จะได้รับ',
  benefits: ['รอบไม่เกินความจุ', 'เตรียมอุปกรณ์ถูกต้องล่วงหน้า', 'ทีมมาจริงตามจอง', 'ข้อมูลทีมครบในที่เดียว', 'ลดตอบแชทซ้ำ', 'ผู้เล่นลงสนามเร็วขึ้น', 'รับงานเหมาสนามง่าย', 'เปิดรอบเพิ่มจากข้อมูลจริง'],
  featureHighlights: [
    { title: 'รอบแบบจำกัดจำนวน', desc: 'ตั้งผู้เล่นสูงสุดต่อรอบ จองรวมถึงความจุแล้วแสดงเต็มทันที', icon: GroupsRoundedIcon },
    { title: 'อุปกรณ์เช่า', desc: 'เลือกปืน ชุดเซฟตี้ และลูกกระสุนตอนจอง สนามเห็นยอดรวมต่อรอบ', icon: Inventory2RoundedIcon },
    { title: 'มัดจำ PromptPay', desc: 'ส่ง QR ในแชท ยืนยันรอบเมื่อชำระสำเร็จ', icon: PaymentsRoundedIcon },
    { title: 'แจ้งเตือน LINE', desc: 'ส่งกติกา แผนที่ เวลารายงานตัว และเตือนก่อนวันเล่น', icon: NotificationsActiveRoundedIcon },
    { title: 'เหมาสนาม', desc: 'ปิดรอบให้กลุ่มบริษัทจากหลังบ้าน ไม่เปิดให้ทีมอื่นจอง', icon: CalendarMonthRoundedIcon },
    { title: 'รายงานสนาม', desc: 'รอบที่ขายดี จำนวนผู้เล่น และอุปกรณ์ที่ถูกเช่า', icon: InsightsRoundedIcon },
  ],
  previewItems: [
    { title: 'ตารางรอบเกม', image: '/images/use-cases/buffet/calendar-view.jpg', alt: 'ตัวอย่างตารางรอบแบบรับจำนวนต่อรอบในระบบหลังบ้าน' },
    { title: 'หน้าจองรอบใน LINE', image: '/images/use-cases/buffet/liff-step-2.jpg', alt: 'ตัวอย่างหน้าเลือกวันและรอบผ่าน LINE' },
    { title: 'รายการทีมวันนี้', image: '/images/use-cases/buffet/daily-queue-list.jpg', alt: 'ตัวอย่างรายการจองประจำวันในระบบหลังบ้าน' },
    { title: 'แจ้งเตือนทีมงาน', image: '/images/use-cases/buffet/notification-dropdown.jpg', alt: 'ตัวอย่างการแจ้งเตือนการจองใหม่ให้ทีมงาน' },
  ],
  faqItems: [
    { q: 'ระบบจองสนาม BB Gun ผ่าน LINE คืออะไร', a: 'คือระบบที่ให้หัวหน้าทีมจองรอบเกมผ่าน LINE OA ของสนามได้เอง ระบุจำนวนผู้เล่น เลือกอุปกรณ์เช่า และวางมัดจำ พร้อมรับแจ้งเตือนอัตโนมัติ.' },
    { q: 'จองเป็นรอบแทนรายชั่วโมงได้หรือไม่', a: 'ได้ ตั้งรอบเกมเป็นบริการแบบรับจำนวนต่อรอบ เช่น รอบละ 3 ชั่วโมง รับสูงสุด 30 คน.' },
    { q: 'จำกัดจำนวนผู้เล่นต่อรอบได้หรือไม่', a: 'ได้ เมื่อยอดจองรวมถึงความจุ ระบบแสดงว่ารอบเต็มและปิดรับอัตโนมัติ.' },
    { q: 'ลูกค้าเลือกอุปกรณ์เช่าตอนจองได้หรือไม่', a: 'ได้ ตั้งปืน ชุดเซฟตี้ และลูกกระสุนเป็นบริการเสริม สนามเห็นจำนวนที่ต้องเตรียมต่อรอบล่วงหน้า.' },
    { q: 'รับมัดจำต่อทีมได้หรือไม่', a: 'ได้ ระบบส่ง PromptPay QR ในแชท LINE และยืนยันรอบให้เมื่อชำระสำเร็จ.' },
    { q: 'กลุ่มบริษัทขอเหมาสนามทำอย่างไร', a: 'พนักงานสร้างการจองแบบปิดรอบจากหลังบ้าน รอบนั้นจะไม่แสดงว่างให้ทีมอื่นจอง.' },
    { q: 'ส่งกติกาสนามและแผนที่ให้ลูกค้าอัตโนมัติได้หรือไม่', a: 'ได้ ใส่กติกา แผนที่ และเวลารายงานตัวในข้อความยืนยัน และระบบเตือนอีกครั้งก่อนวันเล่น.' },
    { q: 'ลูกค้าต้องติดตั้งแอปเพิ่มหรือไม่', a: 'ไม่ต้อง ใช้ LINE ที่มีอยู่แล้วในการจองและรับแจ้งเตือน.' },
    { q: 'รองรับสนามหลายแห่งหรือไม่', a: 'รองรับ ดูรอบทุกสนามในหลังบ้านเดียว และแยกรายงานตามสนามได้.' },
    { q: 'มีรายงานหรือไม่', a: 'มี ดูรอบที่ขายดี จำนวนผู้เล่นต่อรอบ และอุปกรณ์ที่ถูกเช่าได้จาก Dashboard.' },
    { q: 'เริ่มต้นใช้งานอย่างไร', a: 'สมัครใช้งาน ตั้งค่ารอบเกม ความจุ อุปกรณ์เช่า และวันเปิดสนาม เชื่อม LINE OA แล้วเปิดรับจองได้ทันที.' },
  ],
  ctaTitle: 'เปลี่ยน LINE OA ของสนามให้เป็นระบบจองรอบเกมอัตโนมัติ',
  ctaSubtitle: 'ให้ทีมผู้เล่นจองเองได้ตลอด และให้สนามเตรียมอุปกรณ์ทันทุกรอบ',
  schemaDescription: 'ระบบจองสนาม BB Gun และ airsoft ผ่าน LINE OA สำหรับสนามที่รับจองเป็นรอบและเป็นทีม พร้อมอุปกรณ์เช่าและมัดจำ',
};

export default function BbGunFieldBookingSystemPage() {
  return <SolutionPage content={content} />;
}
