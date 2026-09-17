import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Grid,
  Stack,
  Typography,
} from '@mui/material';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import RestaurantRoundedIcon from '@mui/icons-material/RestaurantRounded';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import LocalDiningRoundedIcon from '@mui/icons-material/LocalDiningRounded';
import CoffeeRoundedIcon from '@mui/icons-material/CoffeeRounded';
import RamenDiningRoundedIcon from '@mui/icons-material/RamenDiningRounded';
import OutdoorGrillRoundedIcon from '@mui/icons-material/OutdoorGrillRounded';
import SoupKitchenRoundedIcon from '@mui/icons-material/SoupKitchenRounded';
import ApartmentRoundedIcon from '@mui/icons-material/ApartmentRounded';
import TableRestaurantRoundedIcon from '@mui/icons-material/TableRestaurantRounded';
import NotificationsActiveRoundedIcon from '@mui/icons-material/NotificationsActiveRounded';
import InsightsRoundedIcon from '@mui/icons-material/InsightsRounded';
import EventSeatRoundedIcon from '@mui/icons-material/EventSeatRounded';
import { LandingNavbar } from '@/components/public/landing-navbar';
import { LandingFooter } from '@/components/public/landing-footer';
import { FaqSection } from '@/components/public/faq-section';

export const metadata: Metadata = {
  title: 'ระบบจองโต๊ะร้านอาหารผ่าน LINE OA | ระบบคิวร้านอาหาร | QueueBooking',
  description:
    'ระบบจองโต๊ะร้านอาหารและระบบคิวร้านอาหารผ่าน LINE OA ให้ลูกค้าจองโต๊ะได้ตลอด 24 ชั่วโมง ลดการโทรจอง ลดการตอบแชทซ้ำ พร้อมระบบแจ้งเตือนอัตโนมัติ',
  keywords: [
    'ระบบจองโต๊ะร้านอาหาร',
    'ระบบคิวร้านอาหาร',
    'ร้านอาหารจองผ่าน LINE',
    'ระบบจองร้านอาหาร',
    'โปรแกรมจองโต๊ะร้านอาหาร',
    'ระบบเรียกคิวร้านอาหาร',
    'จองโต๊ะผ่าน LINE OA',
    'ร้านอาหารรับจองออนไลน์',
    'ระบบคิวบุฟเฟต์',
    'ระบบจัดการคิวร้านอาหาร',
    'ระบบคิวร้านอาหารผ่านมือถือ',
    'ระบบจองร้านอาหารออนไลน์',
  ],
  alternates: {
    canonical: '/solutions/restaurant-booking-system',
    languages: {
      'th-TH': '/solutions/restaurant-booking-system',
      'x-default': '/solutions/restaurant-booking-system',
    },
  },
  openGraph: {
    title: 'ระบบจองโต๊ะร้านอาหารผ่าน LINE OA | ระบบคิวร้านอาหาร | QueueBooking',
    description:
      'ระบบจองโต๊ะร้านอาหารและระบบคิวร้านอาหารผ่าน LINE OA ให้ลูกค้าจองโต๊ะได้ตลอด 24 ชั่วโมง ลดการโทรจอง ลดการตอบแชทซ้ำ พร้อมระบบแจ้งเตือนอัตโนมัติ',
    url: '/solutions/restaurant-booking-system',
    type: 'website',
    locale: 'th_TH',
  },
};

const heroFeatures = ['จองโต๊ะผ่าน LINE', 'ระบบคิวอัตโนมัติ', 'แจ้งเตือนลูกค้า', 'รองรับหลายสาขา'];

const painPoints = [
  'ลูกค้าโทรเข้ามาถามโต๊ะว่างทั้งวัน',
  'ตอบแชทจองโต๊ะไม่ทัน',
  'ลูกค้าลืมเวลาจอง',
  'คิวหน้าร้านยาว',
  'จัดการ Walk-in ยาก',
  'ไม่มีข้อมูลสถิติลูกค้า',
];

const solutionFeatures = [
  'จองโต๊ะผ่าน LINE OA',
  'เลือกวันและเวลา',
  'ระบุจำนวนลูกค้า',
  'เลือกสาขา',
  'เลือกโซนที่นั่ง',
  'ระบบคิวหน้าร้าน',
  'แจ้งเตือนก่อนถึงคิว',
  'Dashboard หลังบ้าน',
  'รายงานสถิติการจอง',
];

const howItWorks = [
  'เพิ่มเพื่อน LINE OA',
  'เลือกสาขา',
  'เลือกวันและเวลา',
  'เลือกจำนวนที่นั่ง',
  'ยืนยันการจอง',
  'รับแจ้งเตือนอัตโนมัติ',
];

const useCases = [
  {
    title: 'ร้านอาหารทั่วไป',
    desc: 'รองรับทั้งลูกค้าจองล่วงหน้าและ Walk-in ในช่วงพีค โดยพนักงานเห็นคิวรวมในหน้าจอเดียว',
    icon: RestaurantRoundedIcon,
  },
  {
    title: 'ร้านอาหารครอบครัว',
    desc: 'ลูกค้าระบุจำนวนผู้ใหญ่/เด็กก่อนจอง ช่วยจัดโต๊ะใหญ่ได้พอดีและลดความผิดพลาดหน้างาน',
    icon: GroupsRoundedIcon,
  },
  {
    title: 'ร้านบุฟเฟต์',
    desc: 'จัดคิวตามรอบเวลาและจำนวนที่นั่งต่อรอบ ลดคิวล้นหน้าร้านและควบคุมการหมุนโต๊ะได้ดีขึ้น',
    icon: LocalDiningRoundedIcon,
  },
  {
    title: 'คาเฟ่',
    desc: 'ให้ลูกค้าจองโต๊ะล่วงหน้าผ่าน LINE OA สำหรับช่วงสุดสัปดาห์ที่ลูกค้าแน่น ลดสายที่หน้าร้านรับไม่ทัน',
    icon: CoffeeRoundedIcon,
  },
  {
    title: 'ร้านอาหารญี่ปุ่น',
    desc: 'รองรับการเลือกโซนที่นั่ง เช่น เคาน์เตอร์หรือโต๊ะส่วนตัว พร้อมแจ้งเตือนก่อนเวลานัด',
    icon: RamenDiningRoundedIcon,
  },
  {
    title: 'ร้านอาหารปิ้งย่าง',
    desc: 'บริหารโต๊ะตามขนาดกลุ่มลูกค้าและคิวหน้าร้านแบบเรียลไทม์ ช่วยลดเวลารอคิวของลูกค้า',
    icon: OutdoorGrillRoundedIcon,
  },
  {
    title: 'ร้านชาบู',
    desc: 'ระบบช่วยล็อกจำนวนโต๊ะต่อรอบเวลา ป้องกันการรับคิวเกินความสามารถของทีมบริการ',
    icon: SoupKitchenRoundedIcon,
  },
  {
    title: 'ร้านอาหารในโรงแรม',
    desc: 'จัดการหลายสาขาหรือหลายห้องอาหารในระบบเดียว ผู้จัดการเห็นภาพรวมการจองทั้งหมดได้ทันที',
    icon: ApartmentRoundedIcon,
  },
];

const benefits = [
  'ลดภาระพนักงาน',
  'ลดสายโทรศัพท์',
  'ลดการตอบแชทซ้ำ',
  'ลดการจองผิดพลาด',
  'เพิ่มประสบการณ์ลูกค้า',
  'เพิ่มอัตราการกลับมาใช้บริการ',
  'บริหารโต๊ะได้ดีขึ้น',
  'ดูรายงานได้ทันที',
];

const modules = [
  { title: 'ระบบจองโต๊ะ', icon: TableRestaurantRoundedIcon, desc: 'ลูกค้าเลือกวัน เวลา และจำนวนที่นั่งผ่าน LINE OA ได้เอง' },
  { title: 'ระบบคิวหน้าร้าน', icon: RestaurantRoundedIcon, desc: 'จัดการคิว Walk-in พร้อมเรียงลำดับคิวแบบอัตโนมัติ' },
  { title: 'ระบบเรียกคิว', icon: EventSeatRoundedIcon, desc: 'เรียกคิวจากหน้าจอหลังบ้านหรือหน้าจอแสดงผลได้ทันที' },
  { title: 'ระบบแจ้งเตือน LINE', icon: NotificationsActiveRoundedIcon, desc: 'แจ้งเตือนยืนยันจองและแจ้งเตือนก่อนถึงเวลานัดอัตโนมัติ' },
  { title: 'ระบบหลายสาขา', icon: ApartmentRoundedIcon, desc: 'รองรับหลายสาขาในบัญชีเดียว พร้อมแยกการจัดการแต่ละสาขา' },
  { title: 'Dashboard ผู้จัดการ', icon: InsightsRoundedIcon, desc: 'ดูภาพรวมจำนวนการจอง คิวหน้างาน และประสิทธิภาพการให้บริการ' },
];

const faqs = [
  {
    q: 'ระบบจองโต๊ะร้านอาหารคืออะไร?',
    a: 'คือระบบที่ให้ลูกค้าจองโต๊ะล่วงหน้าผ่าน LINE OA พร้อมจัดการเวลาจอง จำนวนลูกค้า และสาขาแบบอัตโนมัติ.',
  },
  {
    q: 'ร้านอาหารจองผ่าน LINE ได้หรือไม่?',
    a: 'ได้ ลูกค้าสามารถจองโต๊ะผ่าน LINE OA ได้ทันทีโดยไม่ต้องโทรเข้าร้าน.',
  },
  {
    q: 'รองรับหลายสาขาหรือไม่?',
    a: 'รองรับหลายสาขา โดยสามารถแยกโต๊ะ คิว และสถิติของแต่ละสาขาได้ชัดเจน.',
  },
  {
    q: 'รองรับร้านบุฟเฟต์หรือไม่?',
    a: 'รองรับ สามารถจัดการคิวแบบรอบเวลาและกำหนดจำนวนที่นั่งต่อรอบได้.',
  },
  {
    q: 'ลูกค้าต้องติดตั้งแอปเพิ่มหรือไม่?',
    a: 'ไม่ต้องติดตั้งแอปเพิ่ม ลูกค้าใช้ LINE ที่มีอยู่แล้วในการจองโต๊ะได้เลย.',
  },
  {
    q: 'รองรับ Walk-in หรือไม่?',
    a: 'รองรับ ทั้งคิวจองล่วงหน้าและคิว Walk-in หน้าร้านในระบบเดียวกัน.',
  },
  {
    q: 'สามารถจัดการโต๊ะได้หรือไม่?',
    a: 'ได้ สามารถกำหนดจำนวนที่นั่ง โซนโต๊ะ และจัดสรรคิวตามความพร้อมของร้าน.',
  },
  {
    q: 'มีระบบแจ้งเตือนหรือไม่?',
    a: 'มี ระบบแจ้งเตือนผ่าน LINE สำหรับยืนยันการจองและเตือนก่อนถึงเวลารับบริการ.',
  },
  {
    q: 'ดูรายงานได้หรือไม่?',
    a: 'ได้ มี Dashboard สำหรับดูสถิติการจอง ช่วงเวลาพีค และข้อมูลคิวรายวัน.',
  },
  {
    q: 'เริ่มต้นใช้งานอย่างไร?',
    a: 'เริ่มได้โดยเพิ่ม LINE OA และตั้งค่าบริการ สาขา และช่วงเวลา จากนั้นเปิดรับจองได้ทันที.',
  },
  {
    q: 'ระบบคิวร้านอาหารผ่านมือถือใช้งานได้หรือไม่?',
    a: 'ใช้งานได้ทั้งฝั่งลูกค้าและฝั่งพนักงานผ่านมือถือ ช่วยให้จัดการคิวได้จากทุกที่.',
  },
  {
    q: 'ระบบช่วยลดการโทรจองและตอบแชทซ้ำได้จริงหรือไม่?',
    a: 'ช่วยได้จริง เพราะลูกค้าสามารถตรวจสอบคิวและจองโต๊ะเองผ่าน LINE OA ตลอด 24 ชั่วโมง.',
  },
];

const previewItems = [
  { title: 'Reservation Calendar', image: '/images/use-cases/restaurant/calendar-view.jpg', alt: 'ปฏิทินการจองโต๊ะร้านอาหาร' },
  { title: 'Queue Board', image: '/images/use-cases/restaurant/signage-desktop.jpg', alt: 'หน้าจอระบบคิวร้านอาหาร' },
  { title: 'Staff Dashboard', image: '/images/use-cases/restaurant/daily-queue-list.jpg', alt: 'หน้าจอจัดการคิวสำหรับพนักงานร้านอาหาร' },
  { title: 'Analytics Dashboard', image: '/images/use-cases/restaurant/notification-dropdown.jpg', alt: 'ตัวอย่าง Dashboard วิเคราะห์ข้อมูลการจองร้านอาหาร' },
];

export default function RestaurantBookingSystemPage() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://queuebooking.com';
  const canonical = `${appUrl}/solutions/restaurant-booking-system`;

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.a,
      },
    })),
  };

  const softwareSchema = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'QueueBooking',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    inLanguage: ['th'],
    description:
      'ระบบจองโต๊ะร้านอาหารและระบบคิวร้านอาหารผ่าน LINE OA สำหรับร้านอาหารทั่วไป ร้านบุฟเฟต์ คาเฟ่ และธุรกิจหลายสาขา',
    url: canonical,
    offers: {
      '@type': 'Offer',
      priceCurrency: 'THB',
      availability: 'https://schema.org/InStock',
    },
  };

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'หน้าแรก',
        item: `${appUrl}/`,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'โซลูชัน',
        item: `${appUrl}/solutions/restaurant-booking-system`,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: 'ระบบจองโต๊ะร้านอาหาร',
        item: canonical,
      },
    ],
  };

  const organizationSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'QueueBooking LINE',
    url: appUrl,
    contactPoint: [
      {
        '@type': 'ContactPoint',
        contactType: 'sales',
        email: 'amnart.gl@gmail.com',
        telephone: '+66-85-608-3298',
      },
    ],
  };

  return (
    <main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }} />

      <LandingNavbar />

      <Box sx={{ py: { xs: 7, md: 9 }, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Container maxWidth="lg">
          <Grid container spacing={3} alignItems="center">
            <Grid size={{ xs: 12, md: 7 }}>
              <Chip label="Restaurant Queue & Reservation Platform" sx={{ bgcolor: '#EAF3DE', color: '#0a7043', fontWeight: 700 }} />
              <Typography variant="h3" sx={{ mt: 2, fontWeight: 800, fontSize: { xs: 30, md: 44 }, lineHeight: 1.25 }}>
                ให้ลูกค้าจองโต๊ะร้านอาหารผ่าน LINE ได้ตลอด 24 ชั่วโมง
              </Typography>
              <Typography color="text.secondary" sx={{ mt: 2, maxWidth: 720 }}>
                ลดการรับโทรศัพท์ ลดการตอบแชทซ้ำ และจัดการคิวร้านอาหารได้ง่ายขึ้นด้วย QueueBooking
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.2} sx={{ mt: 3 }}>
                <Button component={Link} href="/register" variant="contained" sx={{ bgcolor: '#12a862', '&:hover': { bgcolor: '#0a7043' } }}>
                  ทดลองใช้งานฟรี
                </Button>
                <Button component={Link} href="/contact" variant="outlined" sx={{ borderColor: '#12a862', color: '#12a862' }}>
                  ขอเดโม
                </Button>
              </Stack>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.1} useFlexGap flexWrap="wrap" sx={{ mt: 3 }}>
                {heroFeatures.map((item) => (
                  <Chip key={item} icon={<CheckCircleRoundedIcon sx={{ color: '#0a7043 !important' }} />} label={item} sx={{ bgcolor: '#F3F8EC' }} />
                ))}
              </Stack>
            </Grid>
            <Grid size={{ xs: 12, md: 5 }}>
              <Card sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider', boxShadow: 'none' }}>
                <CardContent>
                  <Typography fontWeight={700} sx={{ mb: 1.2 }}>ภาพรวมการจัดการร้านอาหาร</Typography>
                  <Stack spacing={1}>
                    {['จองโต๊ะล่วงหน้าผ่าน LINE', 'รับคิว Walk-in หน้าร้าน', 'แจ้งเตือนยืนยันอัตโนมัติ', 'สรุปรายงานผู้จัดการร้าน'].map((x) => (
                      <Stack key={x} direction="row" spacing={1} alignItems="center">
                        <CheckCircleRoundedIcon sx={{ color: '#12a862', fontSize: 18 }} />
                        <Typography variant="body2" color="text.secondary">{x}</Typography>
                      </Stack>
                    ))}
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Container>
      </Box>

      <Container maxWidth="lg" sx={{ py: 7 }}>
        <Typography variant="h4" sx={{ fontWeight: 800, mb: 2 }}>ร้านอาหารของคุณกำลังเจอปัญหาเหล่านี้หรือไม่?</Typography>
        <Grid container spacing={1.5}>
          {painPoints.map((item) => (
            <Grid key={item} size={{ xs: 12, sm: 6, md: 4 }}>
              <Card sx={{ height: '100%', borderRadius: 2, border: '1px solid', borderColor: 'divider', boxShadow: 'none' }}>
                <CardContent>
                  <Typography fontWeight={700}>{item}</Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Container>

      <Box sx={{ py: 7, bgcolor: '#FAFBF8', borderTop: '1px solid', borderBottom: '1px solid', borderColor: 'divider' }}>
        <Container maxWidth="lg">
          <Typography variant="h4" sx={{ fontWeight: 800, mb: 2 }}>ระบบจองโต๊ะร้านอาหารผ่าน LINE แบบครบวงจร</Typography>
          <Grid container spacing={1.5}>
            {solutionFeatures.map((item) => (
              <Grid key={item} size={{ xs: 12, sm: 6, md: 4 }}>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ p: 1.5, borderRadius: 2, bgcolor: '#fff', border: '1px solid', borderColor: 'divider', height: '100%' }}>
                  <CheckCircleRoundedIcon sx={{ color: '#12a862' }} />
                  <Typography>{item}</Typography>
                </Stack>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      <Container maxWidth="lg" sx={{ py: 7 }}>
        <Typography variant="h4" sx={{ fontWeight: 800, mb: 2 }}>เริ่มใช้งานง่ายใน 6 ขั้นตอน</Typography>
        <Grid container spacing={1.5}>
          {howItWorks.map((step, index) => (
            <Grid key={step} size={{ xs: 12, sm: 6, md: 4 }}>
              <Card sx={{ height: '100%', borderRadius: 2, border: '1px solid', borderColor: 'divider', boxShadow: 'none' }}>
                <CardContent>
                  <Typography sx={{ color: '#12a862', fontWeight: 800 }}>Step {index + 1}</Typography>
                  <Typography sx={{ mt: 0.8 }} fontWeight={700}>{step}</Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Container>

      <Box sx={{ py: 7, bgcolor: '#FAFBF8', borderTop: '1px solid', borderBottom: '1px solid', borderColor: 'divider' }}>
        <Container maxWidth="lg">
          <Typography variant="h4" sx={{ fontWeight: 800, mb: 2 }}>ตัวอย่างการใช้งานสำหรับร้านอาหารแต่ละประเภท</Typography>
          <Grid container spacing={1.5}>
            {useCases.map((item) => {
              const Icon = item.icon;
              return (
                <Grid key={item.title} size={{ xs: 12, sm: 6, md: 3 }}>
                  <Card sx={{ height: '100%', borderRadius: 2, border: '1px solid', borderColor: 'divider', boxShadow: 'none' }}>
                    <CardContent>
                      <Box sx={{ width: 40, height: 40, borderRadius: 1.5, bgcolor: '#EAF3DE', display: 'grid', placeItems: 'center', mb: 1 }}>
                        <Icon sx={{ color: '#0a7043' }} />
                      </Box>
                      <Typography fontWeight={800}>{item.title}</Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.8 }}>{item.desc}</Typography>
                    </CardContent>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        </Container>
      </Box>

      <Container maxWidth="lg" sx={{ py: 7 }}>
        <Typography variant="h4" sx={{ fontWeight: 800, mb: 2 }}>ประโยชน์ที่ร้านอาหารจะได้รับ</Typography>
        <Grid container spacing={1.5}>
          {benefits.map((item) => (
            <Grid key={item} size={{ xs: 12, sm: 6, md: 3 }}>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ p: 1.5, borderRadius: 2, border: '1px solid', borderColor: 'divider', height: '100%' }}>
                <CheckCircleRoundedIcon sx={{ color: '#12a862' }} />
                <Typography>{item}</Typography>
              </Stack>
            </Grid>
          ))}
        </Grid>
      </Container>

      <Box sx={{ py: 7, bgcolor: '#FAFBF8', borderTop: '1px solid', borderBottom: '1px solid', borderColor: 'divider' }}>
        <Container maxWidth="lg">
          <Typography variant="h4" sx={{ fontWeight: 800, mb: 2 }}>ฟีเจอร์หลักของระบบ</Typography>
          <Grid container spacing={1.5}>
            {modules.map((item) => {
              const Icon = item.icon;
              return (
                <Grid key={item.title} size={{ xs: 12, sm: 6, md: 4 }}>
                  <Card sx={{ height: '100%', borderRadius: 2, border: '1px solid', borderColor: 'divider', boxShadow: 'none' }}>
                    <CardContent>
                      <Stack direction="row" spacing={1.2} alignItems="center">
                        <Box sx={{ width: 40, height: 40, borderRadius: 1.5, bgcolor: '#EAF3DE', display: 'grid', placeItems: 'center' }}>
                          <Icon sx={{ color: '#0a7043' }} />
                        </Box>
                        <Typography fontWeight={800}>{item.title}</Typography>
                      </Stack>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>{item.desc}</Typography>
                    </CardContent>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        </Container>
      </Box>

      <Container maxWidth="lg" sx={{ py: 7 }}>
        <Typography variant="h4" sx={{ fontWeight: 800, mb: 2 }}>Dashboard Preview</Typography>
        <Grid container spacing={1.5}>
          {previewItems.map((item) => (
            <Grid key={item.title} size={{ xs: 12, sm: 6 }}>
              <Card sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider', boxShadow: 'none', overflow: 'hidden' }}>
                <Box sx={{ p: 1.2, borderBottom: '1px solid', borderColor: 'divider' }}>
                  <Typography fontWeight={700}>{item.title}</Typography>
                </Box>
                <Box sx={{ p: 1.2 }}>
                  <Image
                    src={item.image}
                    alt={item.alt}
                    width={1200}
                    height={900}
                    loading="lazy"
                    style={{ width: '100%', height: 'auto', borderRadius: 8, border: '1px solid #e5e7eb' }}
                  />
                </Box>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Container>

      <FaqSection items={faqs} />

      <Container maxWidth="lg" sx={{ pb: 8 }}>
        <Box sx={{ p: { xs: 3, md: 4 }, borderRadius: 3, bgcolor: '#F2F8F4', border: '1px solid #DDEBDD' }}>
          <Typography variant="h4" sx={{ fontWeight: 800, fontSize: { xs: 26, md: 34 } }}>
            เปลี่ยน LINE OA ให้เป็นระบบจองโต๊ะร้านอาหารอัตโนมัติ
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 1 }}>
            ให้ลูกค้าจองโต๊ะได้ง่ายขึ้น และให้ทีมงานมีเวลาบริการลูกค้าได้มากขึ้น
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.2} sx={{ mt: 2.5 }}>
            <Button component={Link} href="/register" variant="contained" sx={{ bgcolor: '#12a862', '&:hover': { bgcolor: '#0a7043' } }}>
              ทดลองใช้งานฟรี
            </Button>
            <Button component={Link} href="/contact" variant="outlined" sx={{ borderColor: '#12a862', color: '#12a862' }}>
              ขอเดโม
            </Button>
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mt: 2.5 }}>
            <Link href="/">หน้าแรก</Link>
            <Link href="/pricing">ดูราคา</Link>
            <Link href="/contact">ติดต่อทีมงาน</Link>
            <Link href="/sandbox-demo">ทดลอง Sandbox</Link>
          </Stack>
        </Box>
      </Container>

      <LandingFooter />
    </main>
  );
}
