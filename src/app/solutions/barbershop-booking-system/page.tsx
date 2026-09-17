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
import ContentCutRoundedIcon from '@mui/icons-material/ContentCutRounded';
import BrushRoundedIcon from '@mui/icons-material/BrushRounded';
import FaceRetouchingNaturalRoundedIcon from '@mui/icons-material/FaceRetouchingNaturalRounded';
import StorefrontRoundedIcon from '@mui/icons-material/StorefrontRounded';
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded';
import NotificationsActiveRoundedIcon from '@mui/icons-material/NotificationsActiveRounded';
import InsightsRoundedIcon from '@mui/icons-material/InsightsRounded';
import EventAvailableRoundedIcon from '@mui/icons-material/EventAvailableRounded';
import { LandingNavbar } from '@/components/public/landing-navbar';
import { LandingFooter } from '@/components/public/landing-footer';
import { FaqSection } from '@/components/public/faq-section';

export const metadata: Metadata = {
  title: 'ระบบจองคิวร้านตัดผมผ่าน LINE OA | ระบบจองร้านทำผม | QueueBooking',
  description:
    'ระบบจองคิวร้านตัดผมและร้านทำผมผ่าน LINE OA ให้ลูกค้าเลือกบริการ เลือกช่าง และเลือกเวลานัดหมายได้ตลอด 24 ชั่วโมง ลดการตอบแชทซ้ำ พร้อมแจ้งเตือนอัตโนมัติ',
  keywords: [
    'ระบบจองคิวร้านตัดผม',
    'ระบบจองร้านทำผม',
    'จองคิวร้านตัดผมออนไลน์',
    'ระบบจองช่างตัดผม',
    'จองร้านทำผมผ่าน LINE',
    'ระบบคิวร้านตัดผม',
    'โปรแกรมจองร้านเสริมสวย',
    'ระบบนัดหมายร้านทำผม',
    'ร้านตัดผมจองผ่าน LINE',
    'ระบบจองคิวร้านเสริมสวย',
    'ระบบจัดการคิวร้านทำผม',
  ],
  alternates: {
    canonical: '/solutions/barbershop-booking-system',
    languages: {
      'th-TH': '/solutions/barbershop-booking-system',
      'x-default': '/solutions/barbershop-booking-system',
    },
  },
  openGraph: {
    title: 'ระบบจองคิวร้านตัดผมผ่าน LINE OA | ระบบจองร้านทำผม | QueueBooking',
    description:
      'ระบบจองคิวร้านตัดผมและร้านทำผมผ่าน LINE OA ให้ลูกค้าเลือกบริการ เลือกช่าง และเลือกเวลานัดหมายได้ตลอด 24 ชั่วโมง ลดการตอบแชทซ้ำ พร้อมแจ้งเตือนอัตโนมัติ',
    url: '/solutions/barbershop-booking-system',
    type: 'website',
    locale: 'th_TH',
  },
};

const heroPills = ['จองผ่าน LINE', 'เลือกช่างได้', 'เลือกบริการได้', 'แจ้งเตือนอัตโนมัติ'];

const painPoints = [
  'ลูกค้าทักถามคิวทั้งวัน',
  'ช่างแต่ละคนว่างไม่ตรงกัน',
  'ลูกค้าลืมนัด',
  'คิวชนกัน',
  'พนักงานต้องตอบแชทซ้ำ',
  'ไม่มีข้อมูลลูกค้าเก่า',
];

const solutionFeatures = [
  'จองผ่าน LINE OA',
  'เลือกบริการ',
  'เลือกช่าง',
  'เลือกสาขา',
  'เลือกวันและเวลา',
  'แจ้งเตือนก่อนนัด',
  'จัดการตารางช่าง',
  'Dashboard หลังบ้าน',
  'รายงานสถิติการจอง',
];

const steps = [
  'เพิ่มเพื่อน LINE OA',
  'เลือกบริการ',
  'เลือกช่าง',
  'เลือกวันและเวลา',
  'ยืนยันการจอง',
  'รับแจ้งเตือนอัตโนมัติ',
];

const useCases = [
  {
    title: 'ร้านตัดผมชาย',
    desc: 'ให้ลูกค้าเลือกช่างประจำและจองช่วงเวลาสั้น ๆ ได้ล่วงหน้า ลดคิวรอหน้าร้านช่วงเย็นและวันหยุด.',
    icon: ContentCutRoundedIcon,
  },
  {
    title: 'Barber Shop',
    desc: 'รองรับงานตัดผมชายแบบคิวต่อคิว พร้อมกำหนดเวลาบริการของแต่ละช่างให้สอดคล้องกับทักษะและความถนัด.',
    icon: EventAvailableRoundedIcon,
  },
  {
    title: 'ร้านเสริมสวย',
    desc: 'เหมาะกับร้านที่มีหลายบริการในบิลเดียว เช่น สระ ไดร์ เซ็ตผม และทรีตเมนต์ โดยให้ลูกค้าเลือกบริการก่อนจอง.',
    icon: BrushRoundedIcon,
  },
  {
    title: 'ร้านทำสีผม',
    desc: 'งานใช้เวลานานสามารถกำหนดช่วงเวลาเฉพาะได้ ลดปัญหาช่างรับงานชนกันและช่วยจัดคิวตามระยะเวลาจริง.',
    icon: FaceRetouchingNaturalRoundedIcon,
  },
  {
    title: 'ร้านทำเล็บและสปา',
    desc: 'ร้านที่มีหลายบริการและต้องจองนานล่วงหน้า สามารถบังคับเลือกช่างและช่วงเวลาได้ชัดเจน.',
    icon: StorefrontRoundedIcon,
  },
  {
    title: 'ร้านความงาม',
    desc: 'จัดการทั้งลูกค้าที่มาทำผมและลูกค้าที่มารับบริการความงามอื่น ๆ ในระบบเดียวพร้อมแจ้งเตือนก่อนนัด.',
    icon: NotificationsActiveRoundedIcon,
  },
  {
    title: 'ร้านทำผมหลายสาขา',
    desc: 'ดูคิวรวมทุกสาขาในหลังบ้านเดียว แยกตารางช่างและรายงานการจองตามสาขาได้ง่าย.',
    icon: CalendarMonthRoundedIcon,
  },
  {
    title: 'ร้านทำผมในห้าง',
    desc: 'รองรับลูกค้าขาจรและลูกค้าจองล่วงหน้าในช่วงพีค โดยทีมงานเห็นภาพรวมคิวและเวลาว่างทันที.',
    icon: InsightsRoundedIcon,
  },
];

const benefits = [
  'ลดการตอบแชท',
  'ลดการรับโทรศัพท์',
  'ลดคิวชนกัน',
  'ลดการลืมนัด',
  'เพิ่มความสะดวกให้ลูกค้า',
  'จัดการเวลาช่างได้ดีขึ้น',
  'เพิ่มโอกาสกลับมาใช้บริการ',
  'ดูรายงานได้ทันที',
];

const featureHighlights = [
  { title: 'ระบบจองคิว', desc: 'ลูกค้าเลือกวัน เวลา และบริการได้เองผ่าน LINE OA', icon: CalendarMonthRoundedIcon },
  { title: 'เลือกช่าง', desc: 'กำหนดช่างเฉพาะหรือช่างว่างตามช่วงเวลาจริง', icon: ContentCutRoundedIcon },
  { title: 'เลือกบริการ', desc: 'ตั้งบริการแต่ละประเภทให้ตรงกับเวลาทำงานจริง', icon: BrushRoundedIcon },
  { title: 'แจ้งเตือน LINE', desc: 'แจ้งยืนยันและเตือนก่อนถึงนัดอัตโนมัติ', icon: NotificationsActiveRoundedIcon },
  { title: 'ระบบหลายสาขา', desc: 'จัดการร้านทำผมหลายสาขาในระบบเดียว', icon: StorefrontRoundedIcon },
  { title: 'Dashboard เจ้าของร้าน', desc: 'ดูภาพรวมคิว การจอง และรายงานจากหลังบ้าน', icon: InsightsRoundedIcon },
];

const faqItems = [
  {
    q: 'ระบบจองคิวร้านตัดผมคืออะไร',
    a: 'คือระบบที่ให้ลูกค้าจองคิวร้านตัดผมและร้านทำผมผ่าน LINE OA ได้เอง พร้อมเลือกบริการ ช่าง และเวลานัดหมายแบบอัตโนมัติ.',
  },
  {
    q: 'ลูกค้าจองผ่าน LINE ได้หรือไม่',
    a: 'ได้ ลูกค้าสามารถจองคิวผ่าน LINE OA ได้ทันทีโดยไม่ต้องโทรเข้าร้าน.',
  },
  {
    q: 'เลือกช่างตัดผมได้หรือไม่',
    a: 'ได้ ระบบรองรับการเลือกช่างเฉพาะหรือเลือกช่างที่ว่างตามช่วงเวลาจริง.',
  },
  {
    q: 'รองรับหลายสาขาหรือไม่',
    a: 'รองรับหลายสาขา โดยสามารถแยกตารางช่าง คิว และรายงานของแต่ละสาขาได้.',
  },
  {
    q: 'รองรับร้านเสริมสวยหรือไม่',
    a: 'รองรับ เหมาะกับร้านเสริมสวยที่มีหลายบริการและต้องจัดการเวลาอย่างแม่นยำ.',
  },
  {
    q: 'ลูกค้าต้องติดตั้งแอปเพิ่มหรือไม่',
    a: 'ไม่ต้อง ลูกค้าใช้ LINE ที่มีอยู่แล้วในการจองและรับแจ้งเตือนได้เลย.',
  },
  {
    q: 'มีระบบแจ้งเตือนก่อนนัดหรือไม่',
    a: 'มี ระบบส่งแจ้งเตือนก่อนถึงวันนัดและส่งข้อความยืนยันการจองอัตโนมัติ.',
  },
  {
    q: 'สามารถจัดการตารางช่างได้หรือไม่',
    a: 'ได้ สามารถกำหนดชั่วโมงทำงาน ตารางว่าง และความพร้อมของช่างแต่ละคนได้.',
  },
  {
    q: 'ดูรายงานการจองได้หรือไม่',
    a: 'ได้ มี Dashboard และรายงานสถิติช่วยดูจำนวนการจอง ช่วงเวลาพีค และประสิทธิภาพการบริการ.',
  },
  {
    q: 'ระบบช่วยลดคิวชนกันอย่างไร',
    a: 'ระบบจะกันช่วงเวลาซ้ำและช่วยจัดตารางช่างให้ตรงกับเวลาจองจริง ลดการจองซ้อนและความผิดพลาดหน้างาน.',
  },
  {
    q: 'ร้านทำผมในห้างใช้งานได้หรือไม่',
    a: 'ใช้งานได้ เหมาะกับร้านที่ต้องรับทั้งลูกค้าจองล่วงหน้าและลูกค้าเดินเข้าในช่วงเวลาคนเยอะ.',
  },
  {
    q: 'เริ่มต้นใช้งานอย่างไร',
    a: 'เริ่มจากเพิ่ม LINE OA แล้วตั้งค่าบริการ ช่าง สาขา และเวลาทำงาน จากนั้นเปิดรับจองได้ทันที.',
  },
];

const previewItems = [
  {
    title: 'Appointment Calendar',
    image: '/images/use-cases/barber/calendar-view.jpg',
    alt: 'ตัวอย่างปฏิทินการจองร้านตัดผม',
  },
  {
    title: 'Staff Schedule',
    image: '/images/use-cases/barber/liff-step-2.jpg',
    alt: 'ตัวอย่างตารางช่างและการเลือกวันเวลา',
  },
  {
    title: 'Booking Dashboard',
    image: '/images/use-cases/barber/daily-queue-list.jpg',
    alt: 'ตัวอย่างแดชบอร์ดการจองร้านตัดผม',
  },
  {
    title: 'Analytics Dashboard',
    image: '/images/use-cases/barber/notification-dropdown.jpg',
    alt: 'ตัวอย่างแดชบอร์ดวิเคราะห์ข้อมูลการจอง',
  },
];

export default function BarbershopBookingSystemPage() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://queuebooking.com';
  const canonical = `${appUrl}/solutions/barbershop-booking-system`;

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqItems.map((item) => ({
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
      'ระบบจองคิวร้านตัดผมและร้านทำผมผ่าน LINE OA สำหรับร้านที่ต้องการให้ลูกค้าเลือกบริการ เลือกช่าง และเลือกเวลานัดหมายได้เอง',
    url: canonical,
    offers: {
      '@type': 'Offer',
      priceCurrency: 'THB',
      availability: 'https://schema.org/InStock',
    },
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
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }} />

      <LandingNavbar />

      <Box
        sx={{
          py: { xs: 7, md: 9 },
          borderBottom: '1px solid',
          borderColor: 'divider',
          background:
            'radial-gradient(circle at top right, rgba(115,192,136,0.14), transparent 30%), linear-gradient(180deg, #ffffff 0%, #fbfcfb 100%)',
        }}
      >
        <Container maxWidth="lg">
          <Grid container spacing={3} alignItems="center">
            <Grid size={{ xs: 12, md: 7 }}>
              <Chip label="Barbershop & Hair Salon Booking Platform" sx={{ bgcolor: '#EAF3DE', color: '#0a7043', fontWeight: 700 }} />
              <Typography variant="h3" sx={{ mt: 2, fontWeight: 800, fontSize: { xs: 30, md: 44 }, lineHeight: 1.2 }}>
                ให้ลูกค้าจองคิวร้านตัดผมผ่าน LINE ได้ตลอด 24 ชั่วโมง
              </Typography>
              <Typography color="text.secondary" sx={{ mt: 2, maxWidth: 720, lineHeight: 1.8 }}>
                ลูกค้าเลือกบริการ เลือกช่าง และเลือกเวลานัดหมายเองได้ ลดการตอบแชทซ้ำ และลดคิวหน้าร้าน
              </Typography>

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.2} sx={{ mt: 3 }}>
                <Button component={Link} href="/register" variant="contained" sx={{ bgcolor: '#12a862', '&:hover': { bgcolor: '#0a7043' } }}>
                  ทดลองใช้งานฟรี
                </Button>
                <Button component={Link} href="/contact" variant="outlined" sx={{ borderColor: '#12a862', color: '#12a862' }}>
                  ขอเดโม
                </Button>
              </Stack>

              <Stack direction="row" spacing={1.1} useFlexGap flexWrap="wrap" sx={{ mt: 3 }}>
                {heroPills.map((pill) => (
                  <Chip
                    key={pill}
                    icon={<CheckCircleRoundedIcon sx={{ color: '#0a7043 !important' }} />}
                    label={pill}
                    sx={{ bgcolor: '#F3F8EC' }}
                  />
                ))}
              </Stack>
            </Grid>

            <Grid size={{ xs: 12, md: 5 }}>
              <Card sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider', boxShadow: 'none' }}>
                <CardContent>
                  <Typography fontWeight={700} sx={{ mb: 1.2 }}>
                    ทำไมร้านผมถึงควรใช้ QueueBooking
                  </Typography>
                  <Stack spacing={1}>
                    {['เลือกช่างตามความถนัด', 'จัดคิวแบบไม่ชนกัน', 'แจ้งเตือนก่อนนัด', 'ดูรายงานหลังบ้าน'].map((item) => (
                      <Stack key={item} direction="row" spacing={1} alignItems="center">
                        <CheckCircleRoundedIcon sx={{ color: '#12a862', fontSize: 18 }} />
                        <Typography variant="body2" color="text.secondary">
                          {item}
                        </Typography>
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
        <Typography variant="h4" sx={{ fontWeight: 800, mb: 2 }}>
          ร้านของคุณกำลังเจอปัญหาเหล่านี้หรือไม่?
        </Typography>
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
          <Typography variant="h4" sx={{ fontWeight: 800, mb: 2 }}>
            ระบบจองร้านตัดผมผ่าน LINE แบบครบวงจร
          </Typography>
          <Grid container spacing={1.5}>
            {solutionFeatures.map((item) => (
              <Grid key={item} size={{ xs: 12, sm: 6, md: 4 }}>
                <Stack
                  direction="row"
                  spacing={1}
                  alignItems="center"
                  sx={{ p: 1.5, borderRadius: 2, bgcolor: '#fff', border: '1px solid', borderColor: 'divider', height: '100%' }}
                >
                  <CheckCircleRoundedIcon sx={{ color: '#12a862' }} />
                  <Typography>{item}</Typography>
                </Stack>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      <Container maxWidth="lg" sx={{ py: 7 }}>
        <Typography variant="h4" sx={{ fontWeight: 800, mb: 2 }}>
          เริ่มใช้งานง่ายใน 6 ขั้นตอน
        </Typography>
        <Grid container spacing={1.5}>
          {steps.map((step, index) => (
            <Grid key={step} size={{ xs: 12, sm: 6, md: 4 }}>
              <Card sx={{ height: '100%', borderRadius: 2, border: '1px solid', borderColor: 'divider', boxShadow: 'none' }}>
                <CardContent>
                  <Typography sx={{ color: '#12a862', fontWeight: 800 }}>Step {index + 1}</Typography>
                  <Typography sx={{ mt: 0.8 }} fontWeight={700}>
                    {step}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Container>

      <Box sx={{ py: 7, bgcolor: '#FAFBF8', borderTop: '1px solid', borderBottom: '1px solid', borderColor: 'divider' }}>
        <Container maxWidth="lg">
          <Typography variant="h4" sx={{ fontWeight: 800, mb: 2 }}>
            ตัวอย่างการใช้งานสำหรับร้านทำผมแต่ละประเภท
          </Typography>
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
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.8 }}>
                        {item.desc}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        </Container>
      </Box>

      <Container maxWidth="lg" sx={{ py: 7 }}>
        <Typography variant="h4" sx={{ fontWeight: 800, mb: 2 }}>
          ประโยชน์ที่ร้านตัดผมจะได้รับ
        </Typography>
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
          <Typography variant="h4" sx={{ fontWeight: 800, mb: 2 }}>
            ฟีเจอร์เด่นของระบบ
          </Typography>
          <Grid container spacing={1.5}>
            {featureHighlights.map((item) => {
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
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        {item.desc}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        </Container>
      </Box>

      <Container maxWidth="lg" sx={{ py: 7 }}>
        <Typography variant="h4" sx={{ fontWeight: 800, mb: 2 }}>
          Dashboard Preview
        </Typography>
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

      <FaqSection items={faqItems} />

      <Container maxWidth="lg" sx={{ pb: 8 }}>
        <Box sx={{ p: { xs: 3, md: 4 }, borderRadius: 3, bgcolor: '#F2F8F4', border: '1px solid #DDEBDD' }}>
          <Typography variant="h4" sx={{ fontWeight: 800, fontSize: { xs: 26, md: 34 } }}>
            เปลี่ยน LINE OA ให้เป็นระบบจองคิวร้านตัดผมอัตโนมัติ
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 1 }}>
            ให้ลูกค้าจองคิวได้เอง และให้ทีมงานมีเวลามากขึ้นในการดูแลลูกค้า
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
