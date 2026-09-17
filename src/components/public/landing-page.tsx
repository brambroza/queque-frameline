'use client';

import { useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import AccessTimeRoundedIcon from '@mui/icons-material/AccessTimeRounded';
import AddTaskRoundedIcon from '@mui/icons-material/AddTaskRounded';
import ArrowOutwardRoundedIcon from '@mui/icons-material/ArrowOutwardRounded';
import BuildRoundedIcon from '@mui/icons-material/BuildRounded';
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded';
import ChatBubbleOutlineRoundedIcon from '@mui/icons-material/ChatBubbleOutlineRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import DashboardRoundedIcon from '@mui/icons-material/DashboardRounded';
import EventBusyRoundedIcon from '@mui/icons-material/EventBusyRounded';
import KeyboardArrowLeftRoundedIcon from '@mui/icons-material/KeyboardArrowLeftRounded';
import KeyboardArrowRightRoundedIcon from '@mui/icons-material/KeyboardArrowRightRounded';
import LocalHospitalRoundedIcon from '@mui/icons-material/LocalHospitalRounded';
import NotificationsNoneRoundedIcon from '@mui/icons-material/NotificationsNoneRounded';
import QrCode2RoundedIcon from '@mui/icons-material/QrCode2Rounded';
import RestaurantRoundedIcon from '@mui/icons-material/RestaurantRounded';
import GpsFixedRoundedIcon from '@mui/icons-material/GpsFixedRounded';
import SportsTennisRoundedIcon from '@mui/icons-material/SportsTennisRounded';
import StadiumRoundedIcon from '@mui/icons-material/StadiumRounded';
import ContentCutRoundedIcon from '@mui/icons-material/ContentCutRounded';
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded';
import ShieldMoonRoundedIcon from '@mui/icons-material/ShieldMoonRounded';
import StorefrontRoundedIcon from '@mui/icons-material/StorefrontRounded';
import SupportAgentRoundedIcon from '@mui/icons-material/SupportAgentRounded';
import TranslateRoundedIcon from '@mui/icons-material/TranslateRounded';
import UpdateRoundedIcon from '@mui/icons-material/UpdateRounded';
import { faqs, pricingPlans } from './content';
import { DigitalSignageShowcase } from './landing-signage-showcase';
import { LandingFooter } from './landing-footer';
import { LandingNavbar, lineFriendUrl } from './landing-navbar';
import styles from './landing-page.module.css';


const workflowSteps = [
  { number: '01', label: 'ทัก LINE', icon: ChatBubbleOutlineRoundedIcon },
  { number: '02', label: 'เลือกบริการและเวลา', icon: CalendarMonthRoundedIcon },
  { number: '03', label: 'ทีมงานเห็นคิวทันที', icon: DashboardRoundedIcon },
  { number: '04', label: 'รับมัดจำผ่าน PromptPay', icon: QrCode2RoundedIcon },
];

const supportChannels = [
  {
    number: '01',
    title: 'ทักได้ทุกช่องทาง ตลอด 24 ชั่วโมง',
    description: 'LINE OA, โทรศัพท์ หรืออีเมล เรื่องด่วนระบบล่มมีทีมรับแจ้งทุกวัน ไม่เว้นวันหยุด',
    icon: SupportAgentRoundedIcon,
  },
  {
    number: '02',
    title: 'ทีมคนไทยดูแลเอง',
    description: 'คุยภาษาไทย เข้าใจหน้างานร้าน ไม่ต้องแปลปัญหาให้บอทหรือทีมต่างประเทศ',
    icon: TranslateRoundedIcon,
  },
  {
    number: '03',
    title: 'ช่วยตั้งค่าให้ตั้งแต่วันแรก',
    description: 'เชื่อม LINE OA, ตั้งค่า LIFF, ใส่บริการและเวลาทำการให้พร้อมใช้ ไม่ต้องงมเอง',
    icon: SettingsRoundedIcon,
  },
  {
    number: '04',
    title: 'เฝ้าระวังระบบให้ตลอดเวลา',
    description: 'มอนิเตอร์ระบบอัตโนมัติ แจ้งเตือนทีมทันทีที่ผิดปกติ ก่อนที่ร้านคุณจะรู้ตัว',
    icon: ShieldMoonRoundedIcon,
  },
];

const supportStats = [
  { value: '24/7', label: 'รับแจ้งเหตุด่วน' },
  { value: '99.5%', label: 'Uptime SLA' },
  { value: '1 ชม.', label: 'ตอบกลับเรื่องด่วน' },
];

const depositSteps = [
  { number: '01', title: 'ลูกค้าจองคิวใน LINE' },
  { number: '02', title: 'ระบบส่ง PromptPay QR' },
  { number: '03', title: 'ชำระสำเร็จ อัปเดตคิวทันที' },
];

const outcomes = [
  {
    number: '01',
    title: 'ลูกค้าจองได้เอง 24/7',
    description: 'เลือกบริการ วัน และเวลาที่สะดวกได้เองใน LINE โดยไม่ต้องรอแอดมินตอบ',
    icon: AccessTimeRoundedIcon,
  },
  {
    number: '02',
    title: 'ทีมงานจัดคิวจากหน้าจอเดียว',
    description: 'ดูคิวรายวัน เปลี่ยนสถานะ และเรียกคิวได้ทันทีจาก Queue Board',
    icon: DashboardRoundedIcon,
  },
  {
    number: '03',
    title: 'รองรับหลายสาขาและหลายบริการ',
    description: 'เห็นภาพรวมของทุกสาขา พร้อมจัดทรัพยากรและทีมงานให้เหมาะกับแต่ละบริการ',
    icon: StorefrontRoundedIcon,
  },
];

/**
 * Industry tiles under "ออกแบบมาให้เข้ากับธุรกิจบริการ".
 * Each links to its dedicated `/solutions/*` page (or a use-case page when
 * no solution page exists yet) so the strip doubles as internal-link SEO.
 */
const businessTypes = [
  { label: 'ร้านตัดผม', desc: 'เลือกช่าง จองรายนาที', href: '/solutions/barbershop-booking-system', icon: ContentCutRoundedIcon },
  { label: 'คลินิก', desc: 'นัดแพทย์ ขออนุมัติคิว', href: '/solutions/clinic-booking-system', icon: LocalHospitalRoundedIcon },
  { label: 'ร้านอาหาร', desc: 'จองโต๊ะ คิวหน้าร้าน', href: '/solutions/restaurant-booking-system', icon: RestaurantRoundedIcon },
  { label: 'ศูนย์บริการ', desc: 'รับเรื่อง เรียกคิวหน้างาน', href: '/use-cases/service-center', icon: BuildRoundedIcon },
  { label: 'สนามแบด', desc: 'จองคอร์ทรายชั่วโมง มัดจำ', href: '/solutions/badminton-court-booking-system', icon: StadiumRoundedIcon },
  { label: 'สนามเทนนิส', desc: 'คอร์ท โค้ช คลาสเรียน', href: '/solutions/tennis-court-booking-system', icon: SportsTennisRoundedIcon },
  { label: 'สนาม BB Gun', desc: 'จองรอบเกม ทีม อุปกรณ์เช่า', href: '/solutions/bb-gun-field-booking-system', icon: GpsFixedRoundedIcon },
  { label: 'ธุรกิจอื่น ๆ', desc: 'ดูตัวอย่างการใช้งานทั้งหมด', href: '/use-cases', icon: StorefrontRoundedIcon },
];

const queueRows = [
  { queue: 'A012', customer: 'คุณศิรินันท์', service: 'ตรวจสุขภาพ', time: '09:30', status: 'รอเรียก' },
  { queue: 'A011', customer: 'คุณณิชา', service: 'พบทันตแพทย์', time: '09:00', status: 'กำลังบริการ' },
  { queue: 'A010', customer: 'คุณพีรดา', service: 'ฉีดวัคซีน', time: '08:45', status: 'เสร็จแล้ว' },
  { queue: 'A009', customer: 'คุณวรพล', service: 'ปรึกษาแพทย์', time: '08:30', status: 'เสร็จแล้ว' },
];

function ArrowIcon() {
  return <ArrowOutwardRoundedIcon aria-hidden="true" fontSize="small" />;
}

function LineConversation() {
  return (
    <div className={styles.chatWindow} data-product-layer>
      <div className={styles.windowBar}>
        <span className={styles.miniBrand}><span>Q</span> QueueBooking</span>
        <span>•••</span>
      </div>
      <div className={styles.chatBody}>
        <div className={styles.chatDate}>วันนี้</div>
        <div className={styles.messageIncoming}>สวัสดีค่ะ 👋<br />ต้องการจองคิวบริการอะไรคะ</div>
        <div className={styles.messageOutgoing}>ขอตรวจสุขภาพพรุ่งนี้ค่ะ</div>
        <div className={styles.bookingPrompt}>
          <span className={styles.lineDot}>LINE</span>
          <div><strong>จองคิวบริการ</strong><small>เลือกบริการและเวลาที่สะดวก</small></div>
          <span>›</span>
        </div>
      </div>
    </div>
  );
}

function PhoneBooking({
  image = '/images/landing/2.jpg',
  label = 'หน้าจองคิวผ่าน LIFF',
  priority = false,
}: {
  image?: string;
  label?: string;
  priority?: boolean;
}) {
  return (
    <div className={styles.phone} data-product-layer>
      <span className={styles.phoneSpeaker} />
      <div className={styles.phoneScreen}>
        <Image src={image} alt={label} fill sizes="(max-width: 768px) 42vw, 240px" priority={priority} />
      </div>
    </div>
  );
}

function DashboardPreview({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`${styles.dashboard} ${compact ? styles.dashboardCompact : ''}`} data-product-layer>
      <div className={styles.dashboardTopbar}>
        <span className={styles.miniBrand}><span>Q</span> QueueBooking</span>
        <span className={styles.liveStatus}><i /> Live</span>
      </div>
      <div className={styles.dashboardBody}>
        <aside className={styles.dashboardSidebar} aria-hidden="true">
          <span className={styles.sidebarActive}><DashboardRoundedIcon /></span>
          <span><CalendarMonthRoundedIcon /></span>
          <span><NotificationsNoneRoundedIcon /></span>
          <span><StorefrontRoundedIcon /></span>
        </aside>
        <div className={styles.dashboardContent}>
          <div className={styles.dashboardHeading}>
            <div><small>ภาพรวมวันนี้</small><strong>คิวทั้งหมด</strong></div>
            <span>5 สิงหาคม 2569</span>
          </div>
          <div className={styles.metricRow}>
            <div><span>รอเรียกคิว</span><strong>12</strong></div>
            <div><span>กำลังบริการ</span><strong>3</strong></div>
            <div><span>เสร็จแล้ว</span><strong>24</strong></div>
          </div>
          <div className={styles.queueTable}>
            <div className={styles.queueHead}><span>คิว</span><span>ลูกค้า</span><span>บริการ</span><span>เวลา</span><span>สถานะ</span></div>
            {queueRows.map((row) => (
              <div className={styles.queueRow} key={row.queue}>
                <strong>{row.queue}</strong><span>{row.customer}</span><span>{row.service}</span><span>{row.time}</span><em>{row.status}</em>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function HeroVisual() {
  return (
    <div className={styles.heroVisual} aria-label="ตัวอย่างการทำงานจาก LINE ไปยังระบบจัดการคิว">
      <svg className={styles.routeLine} viewBox="0 0 720 520" aria-hidden="true" data-route-line>
        <path d="M40 135 C170 135 148 55 275 55 S390 145 485 145 S570 65 690 65" />
        <path d="M95 420 C220 420 210 345 335 345 S470 445 660 365" />
      </svg>
      <LineConversation />
      <PhoneBooking priority />
      <DashboardPreview compact />
      <div className={styles.flowLabelOne} data-float-label><span>01</span> ลูกค้าจองผ่าน LINE</div>
      <div className={styles.flowLabelTwo} data-float-label><span>02</span> ทีมงานเห็นคิวทันที</div>
    </div>
  );
}

function HeroSection() {
  return (
    <section className={styles.hero} id="overview">
      <div className={styles.heroGlow} aria-hidden="true" />
      <div className={styles.container}>
        <div className={styles.heroGrid}>
          <div className={styles.heroCopy}>
            <h1 data-hero-reveal>เปลี่ยนทุกแชท<br />ให้กลายเป็นคิว<br /><span>ที่จัดการง่าย</span></h1>
            <p data-hero-reveal>ให้ลูกค้าจองผ่าน LINE ได้เอง ทีมงานเห็นทุกคิวแบบเรียลไทม์ พร้อมแจ้งเตือนและรับชำระในที่เดียว</p>
            <div className={styles.heroPaymentNote} data-hero-reveal>
              <QrCode2RoundedIcon />
              <strong>รับมัดจำผ่าน PromptPay QR ได้ทันทีใน LINE</strong>
            </div>
            <div className={styles.heroActions} data-hero-reveal>
              <Link href="/register" className={styles.primaryButton}>เริ่มใช้ฟรี <ArrowIcon /></Link>
              <Link href="/sandbox-demo" className={styles.secondaryButton}>ดูระบบตัวอย่าง <ArrowIcon /></Link>
            </div>
            <p className={styles.reassurance} data-hero-reveal><CheckRoundedIcon /> ไม่ต้องใช้บัตรเครดิต <span /> เริ่มได้ในไม่กี่นาที</p>
          </div>
          <div className={styles.heroProduct} data-hero-visual>
            <HeroVisual />
          </div>
        </div>
        <div className={styles.heroBusinesses} data-reveal>
          <p>ออกแบบเพื่อธุรกิจบริการที่ต้องการให้ทุกคิวไหลลื่น</p>
          <div>{businessTypes.map(({ label }) => <span key={label}>{label}</span>)}</div>
        </div>
      </div>
    </section>
  );
}

function WorkflowSection() {
  return (
    <section className={styles.workflowSection} id="workflow">
      <div className={styles.container}>
        <div className={styles.sectionIntro} data-reveal>
          <p className={styles.sectionNumber}>01 / วิธีทำงาน</p>
          <h2>หนึ่งระบบ ดูแล<br />ทุกจังหวะของคิว</h2>
          <p>ตั้งแต่ลูกค้าทัก LINE จนถึงทีมงานเรียกคิว ปิดงาน และรับชำระ</p>
        </div>
        <div className={styles.workflowRail} data-workflow-rail>
          <div className={styles.workflowTrack} aria-hidden="true"><span data-workflow-progress /></div>
          {workflowSteps.map(({ number, label, icon: Icon }, index) => (
            <div className={styles.workflowStep} data-workflow-step key={number}>
              <span>{number}</span><Icon /><strong>{label}</strong>{index < workflowSteps.length - 1 ? <i>→</i> : null}
            </div>
          ))}
        </div>
        <div className={styles.workflowStage} data-reveal>
          <svg className={styles.workflowRoute} viewBox="0 0 1200 500" aria-hidden="true">
            <path data-draw-line d="M15 260 C170 260 155 105 310 105 S430 335 585 335 S700 110 845 110 S1000 280 1180 280" />
          </svg>
          <div className={styles.stageChat} data-parallax="-18"><LineConversation /></div>
          <div className={styles.stagePhone} data-parallax="24"><PhoneBooking /></div>
          <div className={styles.stageDashboard} data-parallax="-12"><DashboardPreview /></div>
          <div className={styles.annotationOne} data-reveal><ChatBubbleOutlineRoundedIcon /><span><strong>จองผ่าน LIFF</strong>ไม่ต้องติดตั้งแอปเพิ่ม</span></div>
          <div className={styles.annotationTwo} data-reveal><DashboardRoundedIcon /><span><strong>Queue Board เรียลไทม์</strong>ทุกสาขาเห็นข้อมูลชุดเดียวกัน</span></div>
          <div className={styles.annotationThree} data-reveal><QrCode2RoundedIcon /><span><strong>PromptPay QR</strong>รับชำระและออกใบเสร็จ</span></div>
        </div>
      </div>
    </section>
  );
}

function PromptPayDepositSection() {
  return (
    <section className={styles.depositSection} id="deposit" data-deposit-section>
      <div className={styles.container}>
        <div className={styles.depositGrid}>
          <div className={styles.depositCopy}>
            <p className={styles.depositNumber} data-deposit-copy>02 / PromptPay Deposit</p>
            <h2 data-deposit-copy>รับมัดจำผ่าน<br /><span>PromptPay QR</span><br />ได้ทันทีใน LINE</h2>
            <p data-deposit-copy>
              ล็อกคิวก่อนวันนัด ลดโอกาส no-show และไม่ต้องส่งเลขบัญชีซ้ำ ลูกค้าสแกนจ่ายได้จาก QR ที่ได้รับใน LINE
            </p>
            <Link href="/features/promptpay-payment" className={styles.depositLink} data-deposit-copy>
              ดูรายละเอียดการรับมัดจำ <ArrowIcon />
            </Link>
            <div className={styles.depositSteps}>
              {depositSteps.map((step) => (
                <div key={step.number} data-deposit-step>
                  <span>{step.number}</span>
                  <strong>{step.title}</strong>
                </div>
              ))}
            </div>
          </div>

          <div className={styles.depositVisual} data-deposit-visual aria-label="ตัวอย่างการรับมัดจำผ่าน PromptPay QR ใน LINE">
            <svg className={styles.depositRoute} viewBox="0 0 760 650" aria-hidden="true">
              <path data-deposit-line d="M32 190 C160 68 262 232 356 214 S480 80 720 150" />
              <path data-deposit-line d="M58 485 C220 550 294 386 420 410 S550 540 716 455" />
            </svg>
            <div className={styles.depositChat} data-deposit-screen="chat"><LineConversation /></div>
            <div className={styles.depositQrPhone} data-deposit-screen="qr">
              <PhoneBooking image="/images/landing/p1.jpg" label="หน้าชำระมัดจำด้วย PromptPay QR" />
            </div>
            <div className={styles.depositReceipt} data-deposit-screen="receipt">
              <Image
                src="/images/landing/p2.jpg"
                alt="ใบเสร็จยืนยันการชำระมัดจำสำเร็จ"
                fill
                sizes="(max-width: 720px) 46vw, 260px"
              />
            </div>
            <div className={styles.depositStatus} data-deposit-status>
              <span><CheckRoundedIcon /> มัดจำสำเร็จ</span>
              <strong>600.00 บาท</strong>
              <small>คิว A003 • ยืนยันอัตโนมัติ</small>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

const calendarDays = [
  { day: 'จ.', date: '11' },
  { day: 'อ.', date: '12', active: true },
  { day: 'พ.', date: '13' },
  { day: 'พฤ.', date: '14' },
  { day: 'ศ.', date: '15' },
];

const calendarTimes = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00'];

function GoogleCalendarShowcase() {
  return (
    <section
      className={styles.googleCalendarSection}
      id="google-calendar"
      data-google-calendar-section
    >
      <div className={styles.container}>
        <div className={styles.googleCalendarGrid}>
          <div className={styles.googleCalendarCopy}>
            <p className={styles.sectionNumber} data-google-calendar-copy>
              03 / Google Calendar
            </p>
            <h2 data-google-calendar-copy>
              <span>ทุกการจอง</span>
              <span>อยู่ในปฏิทินของร้าน</span>
            </h2>
            <p data-google-calendar-copy>
              เชื่อม Google Calendar ของแต่ละร้านเพียงครั้งเดียว แล้วระบบส่งการจองใหม่
              การเลื่อนเวลา และการยกเลิกไปยังปฏิทินหลักโดยอัตโนมัติ
            </p>
            <Link href="/register" className={styles.primaryButton} data-google-calendar-copy>
              เริ่มใช้ฟรี <ArrowIcon />
            </Link>
            <span className={styles.googleCalendarSettings} data-google-calendar-copy>
              <SettingsRoundedIcon /> เชื่อมต่อเองได้ในหน้า Settings
            </span>
          </div>

          <div
            className={styles.googleCalendarVisual}
            data-google-calendar-visual
            aria-label="ตัวอย่างการซิงก์การจองของร้านไปยัง Google Calendar"
          >
            <div className={styles.calendarBookingPanel} data-calendar-panel="booking">
              <div className={styles.calendarBookingHeader}>
                <span className={styles.calendarBookingMark}>Q</span>
                <strong>QueueBooking</strong>
              </div>
              <div className={styles.calendarShopRow}>
                <span><StorefrontRoundedIcon /></span>
                <div><small>ร้านที่เชื่อมต่อ</small><strong>SHOP-TTLS2P</strong></div>
              </div>
              <div className={styles.calendarActionList}>
                <article className={styles.calendarActionNew} data-calendar-action>
                  <span><AddTaskRoundedIcon /></span>
                  <div><strong>การจองใหม่</strong><p>ตรวจสุขภาพ · คุณศิรินันท์</p><small>10:00–10:30</small></div>
                </article>
                <article className={styles.calendarActionMoved} data-calendar-action>
                  <span><UpdateRoundedIcon /></span>
                  <div><strong>เลื่อนเวลา</strong><p>ตรวจสุขภาพ · คุณศิรินันท์</p><small>ย้ายเวลาเป็น 11:00–11:30</small></div>
                </article>
                <article className={styles.calendarActionCancelled} data-calendar-action>
                  <span><EventBusyRoundedIcon /></span>
                  <div><strong>ยกเลิก</strong><p>ตรวจสุขภาพ · คุณศิรินันท์</p><small>นำ Event ออกจากปฏิทิน</small></div>
                </article>
              </div>
            </div>

            <div className={styles.calendarSyncBridge} aria-hidden="true">
              <span className={styles.calendarConnected}>
                <i data-calendar-sync-pulse />
                <CheckRoundedIcon /> เชื่อมต่อแล้ว
              </span>
              <span className={styles.calendarSyncNew}><i /><ArrowOutwardRoundedIcon /></span>
              <span className={styles.calendarSyncMoved}><i /><ArrowOutwardRoundedIcon /></span>
              <span className={styles.calendarSyncCancelled}><i /><ArrowOutwardRoundedIcon /></span>
            </div>

            <div className={styles.googleCalendarPanel} data-calendar-panel="calendar">
              <div className={styles.googleCalendarToolbar}>
                <div className={styles.googleCalendarTitle}>
                  <span><CalendarMonthRoundedIcon /></span>
                  <strong>Google Calendar</strong>
                </div>
                <div className={styles.googleCalendarControls} aria-hidden="true">
                  <KeyboardArrowLeftRoundedIcon />
                  <KeyboardArrowRightRoundedIcon />
                  <span>สัปดาห์</span>
                </div>
              </div>
              <div className={styles.googleCalendarWeekHeader}>
                <span />
                {calendarDays.map((item) => (
                  <span key={item.date} className={item.active ? styles.googleCalendarDayActive : ''}>
                    <small>{item.day}</small><strong>{item.date}</strong>
                  </span>
                ))}
              </div>
              <div className={styles.googleCalendarSchedule}>
                <div className={styles.googleCalendarTimes}>
                  {calendarTimes.map((time) => <span key={time}>{time}</span>)}
                </div>
                <div className={styles.googleCalendarDayGrid}>
                  <article className={styles.googleEventNew} data-calendar-event>
                    <strong>ตรวจสุขภาพ · คุณศิรินันท์</strong><small>10:00–10:30</small>
                  </article>
                  <article className={styles.googleEventMoved} data-calendar-event>
                    <strong>เลื่อนเวลาแล้ว</strong><small>11:00–11:30</small>
                  </article>
                  <article className={styles.googleEventCancelled} data-calendar-event>
                    <strong>ยกเลิกการจอง</strong>
                  </article>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function OutcomeSection() {
  return (
    <section className={styles.outcomeSection} id="features">
      <div className={styles.container}>
        <div className={styles.outcomeGrid}>
          <div className={styles.outcomeCopy}>
            <div className={styles.sectionIntro} data-reveal>
              <p className={styles.sectionNumber}>05 / ผลลัพธ์</p>
              <h2>คิวลื่น ทีมเบา<br />ลูกค้าไม่ต้องรอ</h2>
              <p>ลดงานตอบแชทซ้ำ ลดคิวซ้อน และเห็นภาพรวมทุกสาขา</p>
            </div>
            <div className={styles.outcomeList}>
              {outcomes.map(({ number, title, description, icon: Icon }) => (
                <article className={styles.outcomeItem} data-outcome key={number}>
                  <div className={styles.outcomeIcon}><span>{number}</span><Icon /></div>
                  <div><h3>{title}</h3><p>{description}</p></div>
                </article>
              ))}
            </div>
          </div>
          <div className={styles.outcomeVisual} data-reveal>
            <div className={styles.outcomeDashboard} data-parallax="-22"><DashboardPreview /></div>
            <div className={styles.outcomePhone} data-parallax="28"><PhoneBooking image="/images/landing/1.jpg" /></div>
            <div className={styles.liveQueueCard} data-float-label>
              <span><i /> คิวล่าสุด</span><strong>A012</strong><small>พร้อมเรียกคิว</small>
            </div>
          </div>
        </div>
        <div className={styles.businessStrip} data-reveal id="solutions">
          <p>ออกแบบมาให้เข้ากับธุรกิจบริการ</p>
          <div>
            {businessTypes.map(({ label, desc, href, icon: Icon }) => (
              <Link key={label} href={href} className={styles.businessTile}>
                <Icon />
                <span><strong>{label}</strong><small>{desc}</small></span>
                <ArrowIcon />
              </Link>
            ))}
          </div>
        </div>
        <div className={styles.featureRail} aria-label="ฟีเจอร์หลัก" data-reveal>
          {['LINE OA Booking', 'LIFF Booking', 'Auto Reply', 'Queue Board', 'Digital Signage', 'Multi-branch', 'PromptPay Deposit', 'Reports', 'Google Calendar Sync'].map((feature, index) => (
            <span key={feature}><i>{String(index + 1).padStart(2, '0')}</i>{feature}</span>
          ))}
        </div>
      </div>
    </section>
  );
}

function PricingSection() {
  const previewPlans = pricingPlans.slice(0, 4);

  return (
    <section className={styles.pricingSection} id="pricing">
      <div className={styles.container}>
        <div className={`${styles.sectionIntro} ${styles.pricingIntro}`} data-reveal>
          <p className={styles.sectionNumber}>06 / ราคา</p>
          <h2>เริ่มเล็ก แล้วโตไป<br />พร้อมทุกสาขา</h2>
          <p>เริ่มต้นฟรี 50 คิวต่อเดือน เปลี่ยนแพ็กเกจได้ตลอด</p>
        </div>
        <div className={styles.pricingRail}>
          {previewPlans.map((plan) => {
            const featured = plan.highlight ?? false;
            // Carry the chosen plan into registration so the signup is recorded
            // as an upgrade lead instead of losing the buying intent.
            const ctaHref = plan.contactSales ? '/contact' : `/register?plan=${plan.code}`;
            return (
              <article className={`${styles.priceColumn} ${featured ? styles.priceFeatured : ''}`} data-price-column key={plan.code}>
                <div>
                  <h3>{plan.name}</h3>
                  <p className={styles.price}><strong>{plan.price.replace(' บาท', '')}</strong>{plan.price.includes('บาท') ? ' บาท' : ''}</p>
                  <p className={styles.period}>{plan.period.replace('/', '')}</p>
                </div>
                <ul>{plan.items.slice(0, 4).map((item) => <li key={item}><CheckRoundedIcon />{item}</li>)}</ul>
                <Link href={ctaHref} className={featured ? styles.primaryButton : styles.priceButton}>
                  {plan.contactSales ? 'ติดต่อฝ่ายขาย' : 'เริ่มใช้ฟรี'}
                </Link>
              </article>
            );
          })}
        </div>
        <div className={styles.pricingMore} data-reveal>
          <p>ต้องการฟีเจอร์สำหรับองค์กรหรือจำนวนคิวที่มากขึ้น?</p>
          <Link href="/pricing">เปรียบเทียบทุกแพ็กเกจ <ArrowIcon /></Link>
        </div>
      </div>
    </section>
  );
}

/**
 * หน้าแรกฝัง FAQPage JSON-LD อยู่แล้ว แต่ก่อนหน้านี้ไม่มี FAQ ให้เห็นบนหน้าจอ
 * ซึ่งผิดนโยบาย rich result ของ Google — และปิดข้อสงสัยก่อนกดสมัครไม่ได้ด้วย
 */
function LandingFaqSection() {
  return (
    <section className={styles.supportSection} id="faq">
      <div className={styles.container}>
        <div className={styles.sectionIntro} data-reveal>
          <p className={styles.sectionNumber}>08 / คำถามที่พบบ่อย</p>
          <h2>เคลียร์ก่อนเริ่ม</h2>
        </div>
        <div className="mx-auto mt-6 max-w-3xl space-y-2">
          {faqs.map((f) => (
            <details key={f.q} className="rounded-xl border border-black/10 bg-white/60 px-4 py-3">
              <summary className="cursor-pointer list-none text-base font-semibold">{f.q}</summary>
              <p className="mt-2 text-sm opacity-80">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function SupportSection() {
  return (
    <section className={styles.supportSection} id="support">
      <div className={styles.container}>
        <div className={styles.sectionIntro} data-reveal>
          <p className={styles.sectionNumber}>07 / ซัพพอร์ต</p>
          <h2>ทีมงานพร้อมช่วย<br />ตลอด 24 ชั่วโมง</h2>
          <p>ติดตั้ง ปรับระบบ หรือแก้ปัญหาเร่งด่วน ทักหาเราได้ทุกวัน ไม่มีวันหยุด</p>
        </div>
        <div className={styles.supportGrid}>
          {supportChannels.map(({ number, title, description, icon: Icon }) => (
            <article className={styles.supportCard} data-reveal key={number}>
              <div className={styles.supportCardIcon}><Icon /><span>{number}</span></div>
              <h3>{title}</h3>
              <p>{description}</p>
            </article>
          ))}
        </div>
        <div className={styles.supportBar} data-reveal>
          <div className={styles.supportStats}>
            {supportStats.map(({ value, label }) => (
              <div key={label}><strong>{value}</strong><span>{label}</span></div>
            ))}
          </div>
          <div className={styles.supportActions}>
            <a href={lineFriendUrl} className={styles.primaryButton} target="_blank" rel="noopener noreferrer">
              <ChatBubbleOutlineRoundedIcon /> ทักทีมซัพพอร์ต
            </a>
            <a href="tel:+66856083298">โทร 085-608-3298 <ArrowIcon /></a>
          </div>
        </div>
      </div>
    </section>
  );
}

function LineFriendSection() {
  return (
    <section className={styles.lineFriendSection} id="add-line" data-line-friend-section>
      <div className={styles.container}>
        <div className={styles.lineFriendInner}>
          <div className={styles.lineFriendCopy}>
            <p data-line-friend-copy>คุยกับทีม QueueBooking ได้โดยตรง</p>
            <h2 data-line-friend-copy>อยากรู้ว่าระบบ<br />เหมาะกับร้านคุณไหม?</h2>
            <p data-line-friend-copy>
              เพิ่มเพื่อน LINE เพื่อสอบถามฟีเจอร์ ดูตัวอย่างระบบ หรือให้เราช่วยแนะนำแพ็กเกจที่เหมาะกับธุรกิจของคุณ
            </p>
            <a
              href={lineFriendUrl}
              className={styles.lineFriendButton}
              target="_blank"
              rel="noopener noreferrer"
              data-line-friend-copy
            >
              <ChatBubbleOutlineRoundedIcon /> เพิ่มเพื่อนใน LINE <ArrowIcon />
            </a>
            <small data-line-friend-copy>LINE OA: @queuebooking • กดปุ่มได้ทันทีบนมือถือ</small>
          </div>

          <div className={styles.lineFriendQr} data-line-friend-qr>
            <div className={styles.qrFrame}>
              <Image
                src="/images/landing/line-add-friend-qr.png"
                alt="QR Code สำหรับเพิ่มเพื่อน QueueBooking LINE"
                width={360}
                height={360}
                sizes="(max-width: 720px) 250px, 300px"
                unoptimized
              />
            </div>
            <div className={styles.qrCaption}>
              <span><ChatBubbleOutlineRoundedIcon /></span>
              <div><strong>สแกนเพื่อเพิ่มเพื่อน</strong><small>@queuebooking</small></div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className={styles.finalCta}>
      <svg viewBox="0 0 1440 360" aria-hidden="true" className={styles.ctaRoute}>
        <path data-cta-line d="M-40 265 C210 60 370 410 650 180 S1080 55 1480 165" />
      </svg>
      <div className={styles.container}>
        <div className={styles.finalCtaInner}>
          <h2 data-reveal>พร้อมเปลี่ยนการรอคิว<br />ให้เป็นประสบการณ์ที่ดีขึ้นไหม?</h2>
          <div className={styles.ctaActions} data-reveal>
            <Link href="/register" className={styles.ctaLightButton}>เริ่มใช้ฟรี <ArrowIcon /></Link>
            <a href={lineFriendUrl} className={styles.ctaOutlineButton} target="_blank" rel="noopener noreferrer">เพิ่มเพื่อน LINE</a>
            <p>ไม่ต้องใช้บัตรเครดิต <span /> ยกเลิกได้ตลอด</p>
          </div>
        </div>
      </div>
    </section>
  );
}

export function LandingPage() {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let revertMotion = () => {};
    let cancelled = false;

    async function setupMotion() {
      const [{ gsap }, { ScrollTrigger }] = await Promise.all([import('gsap'), import('gsap/ScrollTrigger')]);
      if (cancelled || !root.current) return;

      gsap.registerPlugin(ScrollTrigger);
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reduceMotion) return;

      const context = gsap.context(() => {
        const heroTimeline = gsap.timeline({ defaults: { ease: 'power3.out' } });
        heroTimeline
          .from('[data-hero-reveal]', { y: 42, autoAlpha: 0, duration: 0.9, stagger: 0.1 })
          .from('[data-hero-visual]', { x: 55, autoAlpha: 0, duration: 1.1 }, '-=0.75')
          .from('[data-product-layer]', { y: 34, autoAlpha: 0, duration: 0.8, stagger: 0.11 }, '-=0.7')
          .from('[data-route-line] path', { strokeDashoffset: 720, duration: 1.5, stagger: 0.12 }, '-=0.9')
          .from('[data-float-label]', { y: 14, autoAlpha: 0, duration: 0.6, stagger: 0.1 }, '-=0.7');

        gsap.utils.toArray<HTMLElement>('[data-reveal]').forEach((element) => {
          gsap.from(element, {
            y: 42,
            autoAlpha: 0,
            duration: 0.85,
            ease: 'power3.out',
            scrollTrigger: { trigger: element, start: 'top 88%', once: true },
          });
        });

        gsap.from('[data-workflow-progress]', {
          scaleX: 0,
          ease: 'none',
          scrollTrigger: { trigger: '[data-workflow-rail]', start: 'top 82%', end: 'bottom 44%', scrub: 0.6 },
        });

        gsap.utils.toArray<HTMLElement>('[data-workflow-step]').forEach((step, index) => {
          gsap.from(step, {
            y: 20,
            autoAlpha: 0.25,
            duration: 0.5,
            delay: index * 0.06,
            scrollTrigger: { trigger: step, start: 'top 86%', once: true },
          });
        });

        gsap.from('[data-draw-line]', {
          strokeDashoffset: 1600,
          ease: 'none',
          scrollTrigger: { trigger: '[data-draw-line]', start: 'top 86%', end: 'bottom 42%', scrub: 0.7 },
        });

        const depositTimeline = gsap.timeline({
          scrollTrigger: { trigger: '[data-deposit-section]', start: 'top 76%', once: true },
          defaults: { ease: 'power3.out' },
        });
        depositTimeline
          .from('[data-deposit-copy]', { x: -42, autoAlpha: 0, duration: 0.8, stagger: 0.09 })
          .from('[data-deposit-visual]', { y: 48, autoAlpha: 0, duration: 0.85 }, '-=0.65')
          .from('[data-deposit-line]', { strokeDashoffset: 1300, duration: 1.2, stagger: 0.12 }, '-=0.55')
          .from('[data-deposit-screen="chat"]', { x: -48, rotate: -7, autoAlpha: 0, duration: 0.75 }, '-=0.9')
          .from('[data-deposit-screen="qr"]', { y: 66, rotate: 5, autoAlpha: 0, duration: 0.85 }, '-=0.65')
          .from('[data-deposit-screen="receipt"]', { x: 52, rotate: 9, autoAlpha: 0, duration: 0.8 }, '-=0.68')
          .from('[data-deposit-step]', { y: 22, autoAlpha: 0, duration: 0.55, stagger: 0.1 }, '-=0.7')
          .from('[data-deposit-status]', { scale: 0.86, autoAlpha: 0, duration: 0.55, ease: 'back.out(1.7)' }, '-=0.45');

        gsap.to('[data-deposit-status]', {
          y: -6,
          duration: 1.8,
          ease: 'sine.inOut',
          repeat: -1,
          yoyo: true,
          scrollTrigger: { trigger: '[data-deposit-section]', start: 'top bottom', end: 'bottom top', toggleActions: 'play pause resume pause' },
        });

        const googleCalendarTimeline = gsap.timeline({
          scrollTrigger: { trigger: '[data-google-calendar-section]', start: 'top 76%', once: true },
          defaults: { ease: 'power3.out' },
        });
        googleCalendarTimeline
          .from('[data-google-calendar-copy]', { x: -38, autoAlpha: 0, duration: 0.75, stagger: 0.08 })
          .from('[data-calendar-panel="booking"]', { x: 36, autoAlpha: 0, duration: 0.75 }, '-=0.48')
          .from('[data-calendar-action]', { y: 16, autoAlpha: 0, duration: 0.5, stagger: 0.09 }, '-=0.4')
          .from('[data-calendar-panel="calendar"]', { x: 44, autoAlpha: 0, duration: 0.8 }, '-=0.62')
          .from('[data-calendar-event]', { scaleY: 0, autoAlpha: 0, duration: 0.45, stagger: 0.1, transformOrigin: 'top center' }, '-=0.4');

        const signageTimeline = gsap.timeline({
          scrollTrigger: { trigger: '[data-signage-section]', start: 'top 76%', once: true },
          defaults: { ease: 'power3.out' },
        });
        signageTimeline
          .from('[data-signage-copy]', { x: -38, autoAlpha: 0, duration: 0.75, stagger: 0.08 })
          .from('[data-signage-tv]', { y: 44, scale: 0.96, autoAlpha: 0, duration: 0.9 }, '-=0.5')
          .from('[data-signage-chip]', { y: 16, autoAlpha: 0, duration: 0.5, stagger: 0.08 }, '-=0.45');

        gsap.from('[data-signage-devices-intro]', {
          y: 30,
          autoAlpha: 0,
          duration: 0.7,
          ease: 'power3.out',
          scrollTrigger: { trigger: '[data-signage-devices-intro]', start: 'top 86%', once: true },
        });
        gsap.from('[data-signage-device]', {
          y: 46,
          autoAlpha: 0,
          duration: 0.8,
          stagger: 0.12,
          ease: 'power3.out',
          scrollTrigger: { trigger: '[data-signage-device]', start: 'top 84%', once: true },
        });
        gsap.from('[data-signage-plan]', {
          y: 40,
          autoAlpha: 0,
          duration: 0.75,
          stagger: 0.1,
          ease: 'power3.out',
          scrollTrigger: { trigger: '[data-signage-plan]', start: 'top 84%', once: true },
        });
        gsap.from('[data-signage-services]', {
          autoAlpha: 0,
          duration: 0.6,
          scrollTrigger: { trigger: '[data-signage-services]', start: 'top 92%', once: true },
        });

        gsap.utils.toArray<HTMLElement>('[data-outcome]').forEach((item) => {
          gsap.from(item, {
            x: -34,
            autoAlpha: 0,
            duration: 0.75,
            ease: 'power3.out',
            scrollTrigger: { trigger: item, start: 'top 84%', once: true },
          });
        });

        gsap.utils.toArray<HTMLElement>('[data-parallax]').forEach((layer) => {
          const amount = Number(layer.dataset.parallax ?? 0);
          gsap.fromTo(layer, { y: -amount }, {
            y: amount,
            ease: 'none',
            scrollTrigger: { trigger: layer.parentElement, start: 'top bottom', end: 'bottom top', scrub: 0.8 },
          });
        });

        gsap.from('[data-price-column]', {
          y: 46,
          autoAlpha: 0,
          duration: 0.75,
          stagger: 0.1,
          ease: 'power3.out',
          scrollTrigger: { trigger: '[data-price-column]', start: 'top 84%', once: true },
        });

        const lineFriendTimeline = gsap.timeline({
          scrollTrigger: { trigger: '[data-line-friend-section]', start: 'top 78%', once: true },
          defaults: { ease: 'power3.out' },
        });
        lineFriendTimeline
          .from('[data-line-friend-copy]', { x: -38, autoAlpha: 0, duration: 0.75, stagger: 0.08 })
          .from('[data-line-friend-qr]', { scale: 0.82, rotate: 5, autoAlpha: 0, duration: 0.9, ease: 'back.out(1.35)' }, '-=0.55');

        gsap.to('[data-line-friend-qr]', {
          y: -7,
          duration: 2.1,
          ease: 'sine.inOut',
          repeat: -1,
          yoyo: true,
          scrollTrigger: { trigger: '[data-line-friend-section]', start: 'top bottom', end: 'bottom top', toggleActions: 'play pause resume pause' },
        });

        gsap.from('[data-cta-line]', {
          strokeDashoffset: 1800,
          ease: 'none',
          scrollTrigger: { trigger: '[data-cta-line]', start: 'top 90%', end: 'bottom 55%', scrub: 0.8 },
        });
      }, root);
      revertMotion = () => context.revert();
    }

    setupMotion();
    return () => {
      cancelled = true;
      revertMotion();
    };
  }, []);

  return (
    <div className={styles.page} ref={root}>
      <LandingNavbar />
      <main>
        <HeroSection />
        <WorkflowSection />
        <PromptPayDepositSection />
        <GoogleCalendarShowcase />
        <DigitalSignageShowcase />
        <OutcomeSection />
        <PricingSection />
        <SupportSection />
        <LandingFaqSection />
        <LineFriendSection />
        <FinalCta />
      </main>
      <LandingFooter />
    </div>
  );
}
