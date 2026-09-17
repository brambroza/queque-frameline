import type { Metadata } from 'next';
import SportsTennisRoundedIcon from '@mui/icons-material/SportsTennisRounded';
import SchoolRoundedIcon from '@mui/icons-material/SchoolRounded';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import TimerRoundedIcon from '@mui/icons-material/TimerRounded';
import PaymentsRoundedIcon from '@mui/icons-material/PaymentsRounded';
import StorefrontRoundedIcon from '@mui/icons-material/StorefrontRounded';
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded';
import NotificationsActiveRoundedIcon from '@mui/icons-material/NotificationsActiveRounded';
import InsightsRoundedIcon from '@mui/icons-material/InsightsRounded';
import UmbrellaRoundedIcon from '@mui/icons-material/UmbrellaRounded';
import { SolutionPage, type SolutionPageContent } from '@/components/public/solution-page';

const path = '/solutions/tennis-court-booking-system';
const title = 'ระบบจองสนามเทนนิสผ่าน LINE OA | จองคอร์ท โค้ช และคลาสเรียน | QueueBooking';
const description =
  'ระบบจองสนามเทนนิสผ่าน LINE OA ให้สมาชิกจองคอร์ทรายชั่วโมง จองโค้ชส่วนตัว และคลาสกลุ่มได้เอง ระบบเช็คทั้งคอร์ทและโค้ชว่างพร้อมกัน รับมัดจำ PromptPay และแจ้งเลื่อนเมื่อฝนตกได้ทันที';

export const metadata: Metadata = {
  title,
  description,
  keywords: [
    'ระบบจองสนามเทนนิส',
    'จองคอร์ทเทนนิสผ่าน LINE',
    'ระบบจองโค้ชเทนนิส',
    'โปรแกรมจองสนามเทนนิส',
    'จองสนามเทนนิสออนไลน์',
    'ระบบจัดการสโมสรเทนนิส',
    'ระบบจองคลาสเทนนิส',
    'ระบบจองสนามกีฬา',
  ],
  alternates: { canonical: path, languages: { 'th-TH': path, 'x-default': path } },
  openGraph: { title, description, url: path, type: 'website', locale: 'th_TH' },
};

const content: SolutionPageContent = {
  path,
  badge: 'Tennis Court & Coaching Booking Platform',
  heroTitle: 'ให้สมาชิกจองสนามเทนนิส โค้ช และคลาสเรียนผ่าน LINE ได้ในที่เดียว',
  heroSubtitle:
    'ระบบเช็คทั้งคอร์ทว่างและโค้ชว่างพร้อมกันก่อนยืนยันทุกครั้ง สมาชิกจองเองได้ตลอด 24 ชั่วโมง วางมัดจำ PromptPay ได้ในแชท และเมื่อฝนตกสนามแจ้งเลื่อนทุกคนได้ในไม่กี่นาที',
  heroPills: ['จองคอร์ทรายชั่วโมง', 'จองโค้ชส่วนตัว', 'คลาสกลุ่มจำกัดจำนวน', 'แจ้งเลื่อนเมื่อฝนตก'],
  whyTitle: 'ทำไมสนามเทนนิสถึงควรใช้ QueueBooking',
  whyItems: ['เช็คคอร์ทและโค้ชว่างพร้อมกัน', 'คลาสเต็มแสดงอัตโนมัติ', 'แจ้งเลื่อนทั้งวันในคลิกเดียว', 'รายงานโค้ชและคอร์ทที่ถูกจอง'],
  painTitle: 'สนามของคุณกำลังเจอปัญหาเหล่านี้หรือไม่?',
  painPoints: [
    'โค้ชถูกจองสองคอร์ทเวลาเดียวกัน',
    'คอร์ทที่โค้ชใช้สอนถูกคนอื่นจองทับ',
    'ฝนตกต้องไล่แจ้งเลื่อนทีละคนในแชท',
    'จองคอร์ทช่วงเย็นแล้วไม่มา',
    'พนักงานอยู่นอกอาคาร เห็นแชทช้า',
    'คลาสกลุ่มรับเกินจำนวนเพราะนับไม่ทัน',
  ],
  featuresTitle: 'ระบบจองสนามเทนนิสผ่าน LINE แบบครบวงจร',
  solutionFeatures: [
    'จองคอร์ทผ่าน LINE OA',
    'จองโค้ชส่วนตัว',
    'คลาสกลุ่มจำกัดจำนวนต่อรอบ',
    'ผูกโค้ชกับบริการที่สอน',
    'เช็คคอร์ทและโค้ชว่างพร้อมกัน',
    'รับมัดจำ PromptPay',
    'ย้ายเวลาและแจ้งลูกค้าทาง LINE',
    'ล็อกคอร์สระยะยาวจากหลังบ้าน',
    'รายงานโค้ชและคอร์ท',
  ],
  stepsTitle: 'สมาชิกจองได้ใน 6 ขั้นตอน',
  steps: ['เพิ่มเพื่อน LINE OA ของสนาม', 'เลือกประเภท: คอร์ท / โค้ช / คลาส', 'เลือกวันและเวลา', 'เลือกคอร์ทหรือโค้ชที่ว่าง', 'ชำระมัดจำ PromptPay', 'รับข้อความยืนยันและเตือนก่อนเล่น'],
  useCasesTitle: 'ตัวอย่างการใช้งานสำหรับสนามเทนนิสแต่ละแบบ',
  useCases: [
    { title: 'เช่าคอร์ทรายชั่วโมง', desc: 'เปิดจองคอร์ทเป็นรายชั่วโมง สมาชิกเห็นตารางว่างและจองต่อเนื่องได้เอง.', icon: TimerRoundedIcon },
    { title: 'โค้ชส่วนตัว', desc: 'ตั้งโค้ชแต่ละคนเป็นทรัพยากร ระบบแสดงเฉพาะเวลาที่ทั้งโค้ชและคอร์ทว่างจริง.', icon: SchoolRoundedIcon },
    { title: 'คลาสกลุ่ม', desc: 'กำหนดจำนวนรับต่อรอบ เมื่อเต็มแสดง "เต็ม" ทันที ไม่ต้องให้พนักงานคอยนับ.', icon: GroupsRoundedIcon },
    { title: 'คอร์ทกลางแจ้ง', desc: 'ฝนตกย้ายเวลาจากหลังบ้าน ระบบส่งข้อความแจ้งสมาชิกพร้อมปุ่มรับทราบให้ทันที.', icon: UmbrellaRoundedIcon },
    { title: 'สโมสรสมาชิก', desc: 'สมาชิกประจำจองเองผ่าน LINE ไม่ต้องโทรเข้าสนาม พนักงานเห็นภาพรวมทุกคอร์ท.', icon: SportsTennisRoundedIcon },
    { title: 'คอร์สเรียนระยะยาว', desc: 'สร้างการจองทั้งคอร์สจากหลังบ้าน คอร์ทและโค้ชถูกล็อกตลอดคอร์ส.', icon: CalendarMonthRoundedIcon },
    { title: 'สนามหลายสาขา', desc: 'ดูตารางคอร์ทและโค้ชทุกสาขาในหลังบ้านเดียว แยกรายงานตามสาขา.', icon: StorefrontRoundedIcon },
    { title: 'สนามที่ต้องการรายงาน', desc: 'ดูว่าโค้ชคนไหนถูกจองมากสุด คอร์ทไหนใช้งานต่ำ เพื่อวางโปรโมชันช่วงว่าง.', icon: InsightsRoundedIcon },
  ],
  benefitsTitle: 'ประโยชน์ที่สนามเทนนิสจะได้รับ',
  benefits: ['โค้ชและคอร์ทไม่ชนกัน', 'แจ้งเลื่อนเพราะฝนในไม่กี่นาที', 'ลดคนจองแล้วไม่มา', 'คลาสไม่รับเกินจำนวน', 'สมาชิกจองได้ 24 ชั่วโมง', 'ล็อกคอร์สระยะยาวได้', 'เห็นทุกคอร์ททุกโค้ชหน้าเดียว', 'วางโปรโมชันจากข้อมูลจริง'],
  featureHighlights: [
    { title: 'คอร์ท + โค้ช', desc: 'ตรวจความว่างของทั้งสองอย่างก่อนยืนยันทุกการจอง', icon: SportsTennisRoundedIcon },
    { title: 'คลาสกลุ่ม', desc: 'กำหนดความจุต่อรอบ เต็มแล้วปิดรับอัตโนมัติ', icon: GroupsRoundedIcon },
    { title: 'มัดจำ PromptPay', desc: 'ส่ง QR ในแชท ล็อกคอร์ทเมื่อชำระสำเร็จ', icon: PaymentsRoundedIcon },
    { title: 'แจ้งเลื่อนทาง LINE', desc: 'ย้ายเวลาแล้วระบบส่งข้อความพร้อมปุ่มรับทราบให้ลูกค้า', icon: NotificationsActiveRoundedIcon },
    { title: 'คอร์สระยะยาว', desc: 'สร้างการจองซ้ำทั้งคอร์สจากหลังบ้านครั้งเดียว', icon: CalendarMonthRoundedIcon },
    { title: 'รายงานสนาม', desc: 'อัตราจองโค้ช อัตราใช้คอร์ท และรายได้มัดจำ', icon: InsightsRoundedIcon },
  ],
  previewItems: [
    { title: 'ตารางคอร์ทและโค้ช', image: '/images/use-cases/barber/calendar-view.jpg', alt: 'ตัวอย่างปฏิทินการจองแยกตามทรัพยากรในระบบหลังบ้าน' },
    { title: 'หน้าเลือกโค้ชใน LINE', image: '/images/use-cases/barber/liff-step-2.jpg', alt: 'ตัวอย่างหน้าเลือกผู้ให้บริการและเวลาผ่าน LINE' },
    { title: 'รายการจองวันนี้', image: '/images/use-cases/barber/daily-queue-list.jpg', alt: 'ตัวอย่างรายการจองประจำวันในระบบหลังบ้าน' },
    { title: 'แจ้งเตือนทีมงาน', image: '/images/use-cases/barber/notification-dropdown.jpg', alt: 'ตัวอย่างการแจ้งเตือนการจองใหม่ให้ทีมงาน' },
  ],
  faqItems: [
    { q: 'ระบบจองสนามเทนนิสผ่าน LINE คืออะไร', a: 'คือระบบที่ให้สมาชิกจองคอร์ทเทนนิส โค้ชส่วนตัว และคลาสกลุ่มผ่าน LINE OA ของสนามได้เอง พร้อมมัดจำและแจ้งเตือนอัตโนมัติ.' },
    { q: 'จองโค้ชพร้อมคอร์ทได้หรือไม่', a: 'ได้ ระบบตรวจว่าทั้งโค้ชและคอร์ทว่างในเวลานั้นก่อนยืนยัน จึงไม่เกิดโค้ชชนหรือคอร์ทถูกจองทับ.' },
    { q: 'ตั้งโค้ชให้สอนเฉพาะบางบริการได้หรือไม่', a: 'ได้ ผูกโค้ชกับบริการที่สอน เช่น โค้ช A สอนคลาสเด็ก โค้ช B สอนส่วนตัว ระบบจะแสดงเฉพาะโค้ชที่ตรงกับบริการที่เลือก.' },
    { q: 'คลาสกลุ่มจำกัดจำนวนได้หรือไม่', a: 'ได้ ตั้งจำนวนรับต่อรอบ เมื่อจองครบระบบแสดงว่าเต็มและปิดรับอัตโนมัติ.' },
    { q: 'ฝนตกต้องเลื่อนหลายรายการทำอย่างไร', a: 'ย้ายเวลาจากหลังบ้านทีละรายการหรือยกเลิกรอบ ระบบส่งข้อความแจ้งสมาชิกทาง LINE พร้อมปุ่มรับทราบให้ทันที.' },
    { q: 'รับมัดจำได้หรือไม่', a: 'ได้ ระบบส่ง PromptPay QR ในแชท LINE และล็อกการจองเมื่อชำระสำเร็จ.' },
    { q: 'คอร์สเรียน 10 ครั้งจองครั้งเดียวได้หรือไม่', a: 'ได้ พนักงานสร้างการจองทั้งคอร์สจากหลังบ้าน คอร์ทและโค้ชถูกล็อกตลอดคอร์ส.' },
    { q: 'สมาชิกต้องติดตั้งแอปเพิ่มหรือไม่', a: 'ไม่ต้อง ใช้ LINE ที่มีอยู่แล้วในการจองและรับแจ้งเตือน.' },
    { q: 'รองรับสนามหลายสาขาหรือไม่', a: 'รองรับ ดูตารางคอร์ทและโค้ชทุกสาขาในหลังบ้านเดียว และแยกรายงานตามสาขาได้.' },
    { q: 'มีรายงานหรือไม่', a: 'มี ดูอัตราการจองโค้ชแต่ละคน อัตราใช้คอร์ท ชั่วโมงพีค และรายได้มัดจำได้จาก Dashboard.' },
    { q: 'เริ่มต้นใช้งานอย่างไร', a: 'สมัครใช้งาน ตั้งค่าคอร์ท โค้ช บริการ และเวลาเปิดปิด เชื่อม LINE OA แล้วเปิดรับจองได้ทันที.' },
  ],
  ctaTitle: 'เปลี่ยน LINE OA ของสนามให้เป็นระบบจองคอร์ทและโค้ชอัตโนมัติ',
  ctaSubtitle: 'ให้สมาชิกจองเองได้ตลอด และให้ทีมงานมีเวลาดูแลสนามและผู้เล่นมากขึ้น',
  schemaDescription: 'ระบบจองสนามเทนนิสผ่าน LINE OA สำหรับสนามที่ต้องการให้สมาชิกจองคอร์ท โค้ช และคลาสเรียนได้เอง โดยระบบตรวจความว่างของคอร์ทและโค้ชพร้อมกัน',
};

export default function TennisCourtBookingSystemPage() {
  return <SolutionPage content={content} />;
}
