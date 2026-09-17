import type { Metadata } from 'next';
import StadiumRoundedIcon from '@mui/icons-material/StadiumRounded';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import TimerRoundedIcon from '@mui/icons-material/TimerRounded';
import PaymentsRoundedIcon from '@mui/icons-material/PaymentsRounded';
import StorefrontRoundedIcon from '@mui/icons-material/StorefrontRounded';
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded';
import NotificationsActiveRoundedIcon from '@mui/icons-material/NotificationsActiveRounded';
import InsightsRoundedIcon from '@mui/icons-material/InsightsRounded';
import EventAvailableRoundedIcon from '@mui/icons-material/EventAvailableRounded';
import SchoolRoundedIcon from '@mui/icons-material/SchoolRounded';
import { SolutionPage, type SolutionPageContent } from '@/components/public/solution-page';

const path = '/solutions/badminton-court-booking-system';
const title = 'ระบบจองสนามแบดผ่าน LINE OA | ระบบจองคอร์ทแบดมินตัน | QueueBooking';
const description =
  'ระบบจองสนามแบดมินตันผ่าน LINE OA ให้ลูกค้าเห็นคอร์ทว่างรายชั่วโมง จองคอร์ทและวางมัดจำ PromptPay ได้เอง ลดคอร์ทชน ลดคนจองแล้วไม่มา พร้อมตารางคอร์ทหลังบ้านและแจ้งเตือนอัตโนมัติ';

export const metadata: Metadata = {
  title,
  description,
  keywords: [
    'ระบบจองสนามแบด',
    'ระบบจองสนามแบดมินตัน',
    'จองสนามแบดผ่าน LINE',
    'ระบบจองคอร์ทแบด',
    'โปรแกรมจองสนามแบด',
    'จองคอร์ทแบดออนไลน์',
    'ระบบจัดการสนามแบด',
    'ระบบจองสนามกีฬา',
    'จองสนามกีฬาผ่าน LINE',
  ],
  alternates: { canonical: path, languages: { 'th-TH': path, 'x-default': path } },
  openGraph: { title, description, url: path, type: 'website', locale: 'th_TH' },
};

const content: SolutionPageContent = {
  path,
  badge: 'Badminton Court Booking Platform',
  heroTitle: 'ให้ลูกค้าจองสนามแบดผ่าน LINE ได้เอง เห็นคอร์ทว่างทันที ไม่ต้องรอแอดมินตอบ',
  heroSubtitle:
    'ลูกค้าเลือกวัน เลือกชั่วโมง เลือกคอร์ท และวางมัดจำ PromptPay ได้ในแชท LINE ส่วนสนามเห็นตารางทุกคอร์ทตลอดวันในหลังบ้านเดียว ลดคอร์ทชนและคนจองแล้วไม่มา',
  heroPills: ['จองรายชั่วโมง', 'เห็นคอร์ทว่างทันที', 'รับมัดจำ PromptPay', 'ล็อกก๊วนประจำได้'],
  whyTitle: 'ทำไมสนามแบดถึงควรใช้ QueueBooking',
  whyItems: ['ตารางคอร์ทเดียวทุกช่องทาง', 'มัดจำก่อนล็อกคอร์ท', 'เตือนก่อนถึงเวลาตี', 'รายงานคอร์ทที่ใช้งานสูงสุด'],
  painTitle: 'สนามของคุณกำลังเจอปัญหาเหล่านี้หรือไม่?',
  painPoints: [
    'ลูกค้าทักถาม "คอร์ทว่างไหม" ทั้งวัน',
    'คอร์ทเดียวกันถูกจองซ้อนสองกลุ่ม',
    'จองปากเปล่าแล้วไม่มา เสียรายได้ทั้งชั่วโมง',
    'พนักงานหน้าสนามตอบแชทไม่ทันช่วงเย็น',
    'ก๊วนประจำถูกจองทับหรือลืมล็อก',
    'ไม่รู้ว่าชั่วโมงไหนคอร์ทไหนขายดี',
  ],
  featuresTitle: 'ระบบจองสนามแบดผ่าน LINE แบบครบวงจร',
  solutionFeatures: [
    'จองคอร์ทผ่าน LINE OA',
    'ตั้งค่าคอร์ทแยกรายคอร์ท',
    'ช่องเวลารายชั่วโมง / ครึ่งชั่วโมง',
    'แสดงคอร์ทเต็ม / ว่าง แบบเรียลไทม์',
    'รับมัดจำ PromptPay ตอนจอง',
    'แจ้งเตือนก่อนถึงเวลาตี',
    'ล็อกก๊วนประจำล่วงหน้าทั้งเดือน',
    'Dashboard ตารางคอร์ท',
    'รายงานการใช้คอร์ทและรายได้',
  ],
  stepsTitle: 'ลูกค้าจองคอร์ทได้ใน 6 ขั้นตอน',
  steps: ['เพิ่มเพื่อน LINE OA ของสนาม', 'กดเมนู "จองคอร์ท"', 'เลือกวันและชั่วโมง', 'เลือกคอร์ทที่ว่าง', 'ชำระมัดจำ PromptPay', 'รับข้อความยืนยันและเตือนก่อนตี'],
  useCasesTitle: 'ตัวอย่างการใช้งานสำหรับสนามแบดแต่ละแบบ',
  useCases: [
    { title: 'สนามแบดรายชั่วโมง', desc: 'เปิดจองคอร์ทเป็นรายชั่วโมงทุกคอร์ท ลูกค้าเห็นตารางว่างทั้งวันและจองต่อเนื่องหลายชั่วโมงได้.', icon: TimerRoundedIcon },
    { title: 'สนามที่มีก๊วนประจำ', desc: 'ล็อกคอร์ทให้ก๊วนประจำล่วงหน้าทั้งเดือนจากหลังบ้าน คอร์ทไม่แสดงว่างให้คนอื่นจองทับ.', icon: GroupsRoundedIcon },
    { title: 'สนามที่รับมัดจำ', desc: 'บังคับวางมัดจำก่อนล็อกคอร์ท ลดคนจองแล้วไม่มา และตั้งกติกาคืนเงินตามนโยบายสนาม.', icon: PaymentsRoundedIcon },
    { title: 'สนามที่มีโค้ชสอน', desc: 'ตั้งโค้ชเป็นทรัพยากรแยก ลูกค้าจองคลาสหรือเรียนส่วนตัวได้โดยระบบเช็คทั้งคอร์ทและโค้ชว่าง.', icon: SchoolRoundedIcon },
    { title: 'สนามหลายสาขา', desc: 'ดูตารางคอร์ททุกสาขาในหลังบ้านเดียว แยกรายงานและพนักงานตามสาขา.', icon: StorefrontRoundedIcon },
    { title: 'สนามในศูนย์กีฬา', desc: 'รวมแบด เทนนิส และสนามอื่นในระบบเดียว ลูกค้าเลือกประเภทสนามก่อนจอง.', icon: StadiumRoundedIcon },
    { title: 'สนามที่จัดทัวร์นาเมนต์', desc: 'ปิดคอร์ทช่วงจัดแข่งจากหลังบ้าน ระบบไม่เปิดให้จองในช่วงนั้นอัตโนมัติ.', icon: EventAvailableRoundedIcon },
    { title: 'สนามที่ต้องการรายงาน', desc: 'ดูชั่วโมงพีค คอร์ทที่ใช้งานสูงสุด และรายได้มัดจำ เพื่อตั้งราคาช่วงพีคได้แม่น.', icon: InsightsRoundedIcon },
  ],
  benefitsTitle: 'ประโยชน์ที่สนามแบดจะได้รับ',
  benefits: ['ลดแชทถามคอร์ทว่าง', 'คอร์ทไม่ชนกัน', 'ลดคนจองแล้วไม่มา', 'ล็อกก๊วนประจำได้', 'พนักงานมีเวลาดูแลหน้าสนาม', 'เห็นตารางทุกคอร์ทหน้าเดียว', 'ตั้งราคาช่วงพีคจากข้อมูลจริง', 'ลูกค้าจองได้ 24 ชั่วโมง'],
  featureHighlights: [
    { title: 'ตารางคอร์ท', desc: 'เห็นทุกคอร์ททุกชั่วโมงในหน้าเดียว ย้ายหรือยกเลิกได้ทันที', icon: CalendarMonthRoundedIcon },
    { title: 'จองรายชั่วโมง', desc: 'ตั้งช่วงเวลาจองและเวลาเปิดปิดของสนามได้อิสระ', icon: TimerRoundedIcon },
    { title: 'มัดจำ PromptPay', desc: 'ส่ง QR ในแชท ล็อกคอร์ทเมื่อชำระสำเร็จอัตโนมัติ', icon: PaymentsRoundedIcon },
    { title: 'แจ้งเตือน LINE', desc: 'ยืนยันการจองและเตือนก่อนถึงเวลาตีให้ลูกค้าเอง', icon: NotificationsActiveRoundedIcon },
    { title: 'ก๊วนประจำ', desc: 'สร้างการจองล่วงหน้าซ้ำทุกสัปดาห์จากหลังบ้าน', icon: GroupsRoundedIcon },
    { title: 'รายงานสนาม', desc: 'ชั่วโมงพีค อัตราใช้คอร์ท และรายได้แยกรายคอร์ท', icon: InsightsRoundedIcon },
  ],
  previewItems: [
    { title: 'ตารางคอร์ทรายวัน', image: '/images/use-cases/restaurant/calendar-view.jpg', alt: 'ตัวอย่างตารางการจองรายวันในระบบหลังบ้าน' },
    { title: 'หน้าจองใน LINE', image: '/images/use-cases/restaurant/liff-step-2.jpg', alt: 'ตัวอย่างหน้าเลือกวันเวลาจองผ่าน LINE' },
    { title: 'รายการจองวันนี้', image: '/images/use-cases/restaurant/daily-queue-list.jpg', alt: 'ตัวอย่างรายการจองประจำวันในระบบหลังบ้าน' },
    { title: 'แจ้งเตือนทีมงาน', image: '/images/use-cases/restaurant/notification-dropdown.jpg', alt: 'ตัวอย่างการแจ้งเตือนการจองใหม่ให้ทีมงาน' },
  ],
  faqItems: [
    { q: 'ระบบจองสนามแบดผ่าน LINE คืออะไร', a: 'คือระบบที่ให้ลูกค้าเห็นคอร์ทว่างและจองสนามแบดมินตันผ่าน LINE OA ของสนามได้เอง พร้อมวางมัดจำและรับแจ้งเตือนอัตโนมัติ.' },
    { q: 'ตั้งค่าคอร์ทได้กี่คอร์ท', a: 'ตั้งได้ตามจำนวนคอร์ทจริงของสนาม แต่ละคอร์ทแยกตารางและเวลาเปิดปิดได้อิสระ.' },
    { q: 'จองเป็นรายชั่วโมงได้หรือไม่', a: 'ได้ ตั้งช่วงเวลาจองเป็นรายชั่วโมงหรือครึ่งชั่วโมง และให้ลูกค้าจองต่อเนื่องหลายชั่วโมงได้.' },
    { q: 'รับมัดจำก่อนล็อกคอร์ทได้หรือไม่', a: 'ได้ ระบบส่ง PromptPay QR ในแชท LINE และล็อกคอร์ทให้เมื่อชำระสำเร็จ.' },
    { q: 'ก๊วนประจำจองล่วงหน้าทั้งเดือนได้หรือไม่', a: 'ได้ พนักงานสร้างการจองล่วงหน้าจากหลังบ้านให้ก๊วนประจำ คอร์ทจะไม่แสดงว่างให้คนอื่นจองทับ.' },
    { q: 'ลูกค้าต้องติดตั้งแอปเพิ่มหรือไม่', a: 'ไม่ต้อง ลูกค้าใช้ LINE ที่มีอยู่แล้วในการจองและรับแจ้งเตือน.' },
    { q: 'ระบบเตือนลูกค้าก่อนถึงเวลาตีหรือไม่', a: 'มี ตั้งเวลาเตือนล่วงหน้าได้ เช่น 1 ชั่วโมงก่อนถึงเวลาจอง.' },
    { q: 'ปิดคอร์ทช่วงซ่อมหรือจัดแข่งได้หรือไม่', a: 'ได้ ตั้งวันหยุดหรือปิดคอร์ทเฉพาะช่วงจากหลังบ้าน ระบบจะไม่เปิดให้จองในช่วงนั้น.' },
    { q: 'รองรับสนามหลายสาขาหรือไม่', a: 'รองรับ ดูตารางคอร์ททุกสาขาในหลังบ้านเดียว และแยกรายงานตามสาขาได้.' },
    { q: 'มีรายงานการใช้คอร์ทหรือไม่', a: 'มี ดูชั่วโมงพีค อัตราการใช้คอร์ทแต่ละคอร์ท และรายได้มัดจำได้จาก Dashboard.' },
    { q: 'เริ่มต้นใช้งานอย่างไร', a: 'สมัครใช้งาน ตั้งค่าคอร์ท เวลาเปิดปิด และราคาต่อชั่วโมง เชื่อม LINE OA แล้วเปิดรับจองได้ทันที.' },
  ],
  ctaTitle: 'เปลี่ยน LINE OA ของสนามให้เป็นระบบจองคอร์ทอัตโนมัติ',
  ctaSubtitle: 'ให้ลูกค้าจองคอร์ทได้เอง และให้พนักงานมีเวลาดูแลหน้าสนามมากขึ้น',
  schemaDescription: 'ระบบจองสนามแบดมินตันผ่าน LINE OA สำหรับสนามที่ต้องการให้ลูกค้าเห็นคอร์ทว่าง จองรายชั่วโมง และวางมัดจำได้เอง',
};

export default function BadmintonCourtBookingSystemPage() {
  return <SolutionPage content={content} />;
}
