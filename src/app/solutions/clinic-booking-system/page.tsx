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
import HealingRoundedIcon from '@mui/icons-material/HealingRounded';
import MedicalServicesRoundedIcon from '@mui/icons-material/MedicalServicesRounded';
import MonitorHeartRoundedIcon from '@mui/icons-material/MonitorHeartRounded';
import LocalHospitalRoundedIcon from '@mui/icons-material/LocalHospitalRounded';
import SensorsRoundedIcon from '@mui/icons-material/SensorsRounded';
import NotificationsActiveRoundedIcon from '@mui/icons-material/NotificationsActiveRounded';
import InsightsRoundedIcon from '@mui/icons-material/InsightsRounded';
import EventAvailableRoundedIcon from '@mui/icons-material/EventAvailableRounded';
import { LandingNavbar } from '@/components/public/landing-navbar';
import { LandingFooter } from '@/components/public/landing-footer';
import { FaqSection } from '@/components/public/faq-section';

export const metadata: Metadata = {
  title: 'ระบบจองคิวคลินิกผ่าน LINE OA | โปรแกรมจองคลินิก | นัดหมายแพทย์ออนไลน์ | QueueBooking',
  description:
    'ระบบจองคิวคลินิกและนัดหมายแพทย์ออนไลน์ผ่าน LINE OA ให้คนไข้เลือกวัน เวลา และแพทย์ได้ตลอด 24 ชั่วโมง ลดการโทร ลดการตอบแชทซ้ำ พร้อมระบบแจ้งเตือนอัตโนมัติ',
  keywords: [
    'ระบบจองคิวคลินิก',
    'โปรแกรมจองคลินิก',
    'นัดหมายแพทย์ออนไลน์',
    'ระบบนัดหมายคนไข้',
    'จองคิวคลินิกผ่าน LINE',
    'โปรแกรมบริหารคิวคลินิก',
    'ระบบจองหมอออนไลน์',
    'ระบบจัดการนัดหมายคลินิก',
    'ระบบคิวคลินิก',
    'LINE OA สำหรับคลินิก',
    'ระบบเรียกคิวคลินิก',
    'โปรแกรมจัดการคนไข้',
    'ระบบนัดหมายคลินิกออนไลน์',
  ],
  alternates: {
    canonical: '/solutions/clinic-booking-system',
    languages: {
      'th-TH': '/solutions/clinic-booking-system',
      'x-default': '/solutions/clinic-booking-system',
    },
  },
  openGraph: {
    title: 'ระบบจองคิวคลินิกผ่าน LINE OA | โปรแกรมจองคลินิก | นัดหมายแพทย์ออนไลน์ | QueueBooking',
    description:
      'ระบบจองคิวคลินิกและนัดหมายแพทย์ออนไลน์ผ่าน LINE OA ให้คนไข้เลือกวัน เวลา และแพทย์ได้ตลอด 24 ชั่วโมง ลดการโทร ลดการตอบแชทซ้ำ พร้อมระบบแจ้งเตือนอัตโนมัติ',
    url: '/solutions/clinic-booking-system',
    type: 'website',
    locale: 'th_TH',
  },
};

const heroPills = ['จองผ่าน LINE', 'เลือกแพทย์ได้', 'แจ้งเตือนอัตโนมัติ', 'รองรับหลายสาขา'];

const painPoints = [
  'เจ้าหน้าที่ต้องตอบแชทจองคิวทั้งวัน',
  'คนไข้โทรเข้ามาสอบถามคิวจำนวนมาก',
  'คนไข้ลืมนัด',
  'ตารางแพทย์ชนกัน',
  'คิวหน้าคลินิกแออัด',
  'ไม่มีข้อมูลสถิติการนัดหมาย',
];

const solutionFeatures = [
  'จองคิวผ่าน LINE OA',
  'เลือกแพทย์',
  'เลือกบริการ',
  'เลือกวันและเวลา',
  'เลือกสาขา',
  'แจ้งเตือนก่อนถึงวันนัด',
  'จัดการตารางแพทย์',
  'Dashboard หลังบ้าน',
  'รายงานสถิติการนัดหมาย',
];

const howItWorks = [
  'เพิ่มเพื่อน LINE OA',
  'เลือกบริการ',
  'เลือกแพทย์',
  'เลือกวันและเวลา',
  'ยืนยันการนัดหมาย',
  'รับแจ้งเตือนอัตโนมัติ',
];

const useCases = [
  {
    title: 'คลินิกเวชกรรม',
    desc: 'ช่วยให้คนไข้เลือกแพทย์และช่วงเวลานัดหมายได้ล่วงหน้า ลดจำนวนโทรเข้าหน้าร้านและจัดคิวหน้าคลินิกได้เป็นระบบ.',
    icon: LocalHospitalRoundedIcon,
  },
  {
    title: 'คลินิกทันตกรรม',
    desc: 'เหมาะกับงานตรวจ ฟอกสีฟัน หรือจัดฟันที่ต้องมีเวลานัดชัดเจน พร้อมแจ้งเตือนก่อนถึงคิวให้คนไข้ไม่พลาด.',
    icon: MedicalServicesRoundedIcon,
  },
  {
    title: 'คลินิกความงาม',
    desc: 'รองรับบริการหลายประเภท เช่น เลเซอร์ ทรีตเมนต์ และฉีดผิว โดยจัดแพทย์และหัตถการให้เหมาะกับเวลา.',
    icon: HealingRoundedIcon,
  },
  {
    title: 'คลินิกกายภาพบำบัด',
    desc: 'ควบคุมเวลานัดที่ยืดหยุ่นและเรียงคิวตามลำดับ พร้อมช่วยทีมงานจัดการคนไข้ตามห้องและนักกายภาพ.',
    icon: MonitorHeartRoundedIcon,
  },
  {
    title: 'คลินิกสัตวแพทย์',
    desc: 'แม้จะเป็นเคสสัตว์เลี้ยง ระบบก็ช่วยแยกบริการ นัดหมาย และช่วงเวลาได้ชัดเจนเพื่อลดความวุ่นวายหน้าคลินิก.',
    icon: SensorsRoundedIcon,
  },
  {
    title: 'คลินิกเฉพาะทาง',
    desc: 'รองรับแพทย์หลายสาขาและเคสที่ต้องวางแผนล่วงหน้า ช่วยให้ทีมหน้าบ้านเห็นตารางนัดที่ชัดเจน.',
    icon: EventAvailableRoundedIcon,
  },
  {
    title: 'คลินิกหลายสาขา',
    desc: 'บริหารตารางแพทย์และการนัดหมายข้ามสาขาได้ในระบบเดียว เหมาะกับธุรกิจที่กำลังขยายตัว.',
    icon: InsightsRoundedIcon,
  },
  {
    title: 'ศูนย์สุขภาพและ Wellness',
    desc: 'ใช้กับบริการตรวจสุขภาพ วัดผล หรือโปรแกรมดูแลสุขภาพต่อเนื่องที่ต้องการระบบนัดหมายออนไลน์ที่เชื่อถือได้.',
    icon: NotificationsActiveRoundedIcon,
  },
];

const benefits = [
  'ลดภาระงานแอดมิน',
  'ลดสายโทรศัพท์',
  'ลดการตอบแชทซ้ำ',
  'ลด No Show',
  'เพิ่มประสบการณ์คนไข้',
  'จัดการตารางแพทย์ได้ง่ายขึ้น',
  'เพิ่มประสิทธิภาพการบริการ',
  'ดูรายงานได้ทันที',
];

const featureHighlights = [
  { title: 'ระบบจองคิว', desc: 'คนไข้เลือกวัน เวลา และแพทย์ได้เองผ่าน LINE OA', icon: EventAvailableRoundedIcon },
  { title: 'เลือกแพทย์', desc: 'กำหนดแพทย์เฉพาะทางหรือแพทย์ที่ว่างตามตารางจริง', icon: LocalHospitalRoundedIcon },
  { title: 'เลือกบริการ', desc: 'ตั้งค่าบริการตรวจ วินิจฉัย หรือหัตถการให้ตรงกับเวลาจริง', icon: MedicalServicesRoundedIcon },
  { title: 'แจ้งเตือน LINE', desc: 'ยืนยันการจองและเตือนก่อนถึงนัดอัตโนมัติ', icon: NotificationsActiveRoundedIcon },
  { title: 'ระบบหลายสาขา', desc: 'รองรับหลายสาขาและหลายแพทย์ในบัญชีเดียว', icon: InsightsRoundedIcon },
  { title: 'Dashboard ผู้บริหาร', desc: 'ดูภาพรวมคิว สถิติ และประสิทธิภาพการบริการ', icon: MonitorHeartRoundedIcon },
];

const faqs = [
  { q: 'ระบบจองคิวคลินิกคืออะไร', a: 'คือระบบที่ช่วยให้คนไข้จองคิวคลินิกและนัดหมายแพทย์ออนไลน์ผ่าน LINE OA ได้เอง พร้อมจัดการตารางแพทย์และแจ้งเตือนอัตโนมัติ.' },
  { q: 'คนไข้จองผ่าน LINE ได้หรือไม่', a: 'ได้ คนไข้สามารถจองคิวผ่าน LINE OA ได้ทันที โดยไม่ต้องโทรเข้าคลินิก.' },
  { q: 'เลือกแพทย์ได้หรือไม่', a: 'ได้ ระบบรองรับการเลือกแพทย์ตามความเชี่ยวชาญหรือเลือกแพทย์ที่ว่างตามช่วงเวลาจริง.' },
  { q: 'รองรับหลายสาขาหรือไม่', a: 'รองรับหลายสาขา สามารถแยกคิว แพทย์ และรายงานของแต่ละสาขาได้อย่างชัดเจน.' },
  { q: 'รองรับคลินิกทันตกรรมหรือไม่', a: 'รองรับ เหมาะกับคลินิกทันตกรรมที่ต้องจัดคิวตามเวลานัดเฉพาะและบริการหลายประเภท.' },
  { q: 'รองรับคลินิกความงามหรือไม่', a: 'รองรับ เหมาะกับคลินิกความงามที่มีหัตถการหลายชนิดและต้องการระบบนัดหมายที่เป็นระเบียบ.' },
  { q: 'ต้องติดตั้งแอปเพิ่มหรือไม่', a: 'ไม่ต้อง คนไข้ใช้ LINE ที่มีอยู่แล้วในการจองและรับแจ้งเตือนได้เลย.' },
  { q: 'มีระบบแจ้งเตือนก่อนนัดหรือไม่', a: 'มี ระบบแจ้งเตือนผ่าน LINE ช่วยยืนยันการนัดหมายและเตือนก่อนถึงเวลา.' },
  { q: 'ลดปัญหาคนไข้ไม่มาตามนัดได้หรือไม่', a: 'ได้ ระบบช่วยส่งแจ้งเตือนและยืนยันนัด ลดโอกาสลืมและลด No Show.' },
  { q: 'สามารถดูรายงานการนัดหมายได้หรือไม่', a: 'ได้ มี Dashboard และรายงานสถิติให้ผู้บริหารดูจำนวนคิวและแนวโน้มการใช้งาน.' },
  { q: 'ระบบจัดการคิวคลินิกช่วยเจ้าหน้าที่อย่างไร', a: 'ช่วยลดงานตอบแชทและโทรตอบซ้ำ ทำให้เจ้าหน้าที่มีเวลามากขึ้นในการดูแลคนไข้.' },
  { q: 'รองรับคลินิกกายภาพบำบัดหรือไม่', a: 'รองรับ เหมาะกับงานนัดหมายที่ต้องจัดคิวเป็นช่วงและดูความพร้อมของนักกายภาพ.' },
  { q: 'รองรับคลินิกสัตวแพทย์หรือไม่', a: 'รองรับ สามารถจัดการบริการและนัดหมายสำหรับคลินิกสัตวแพทย์ได้เช่นกัน.' },
  { q: 'เริ่มต้นใช้งานอย่างไร', a: 'เริ่มจากเพิ่ม LINE OA แล้วตั้งค่าบริการ แพทย์ สาขา และช่วงเวลา จากนั้นเปิดรับจองได้ทันที.' },
  { q: 'ระบบนัดหมายคลินิกออนไลน์ใช้งานบนมือถือได้ไหม', a: 'ใช้งานได้ทั้งฝั่งคนไข้และทีมงานบนมือถือ ช่วยให้ดูแลคิวได้จากทุกที่.' },
];

const whyChooseItems = [
  'ใช้งานผ่าน LINE ที่คนไข้คุ้นเคย',
  'ไม่ต้องดาวน์โหลดแอปเพิ่ม',
  'รองรับหลายแพทย์ หลายบริการ',
  'รองรับหลายสาขา',
  'ระบบแจ้งเตือนอัตโนมัติ',
  'ใช้งานง่ายทั้งเจ้าหน้าที่และคนไข้',
];

const previewItems = [
  { title: 'Appointment Calendar', image: '/images/use-cases/clinic/calendar-view.jpg', alt: 'ปฏิทินการนัดหมายคลินิก' },
  { title: 'Doctor Schedule', image: '/images/use-cases/clinic/liff-step-2.jpg', alt: 'ตารางแพทย์และช่วงเวลานัดหมาย' },
  { title: 'Queue Management', image: '/images/use-cases/clinic/daily-queue-list.jpg', alt: 'หน้าจอจัดการคิวคลินิก' },
  { title: 'Analytics Dashboard', image: '/images/use-cases/clinic/notification-dropdown.jpg', alt: 'ตัวอย่างแดชบอร์ดวิเคราะห์ข้อมูลการนัดหมาย' },
];

export default function ClinicBookingSystemPage() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://queuebooking.com';
  const canonical = `${appUrl}/solutions/clinic-booking-system`;

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
      'ระบบจองคิวคลินิกและนัดหมายแพทย์ออนไลน์ผ่าน LINE OA สำหรับคลินิกเวชกรรม ทันตกรรม ความงาม และคลินิกหลายสาขา',
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
              <Chip label="Clinic Appointment & Queue Management Platform" sx={{ bgcolor: '#EAF3DE', color: '#0a7043', fontWeight: 700 }} />
              <Typography variant="h3" sx={{ mt: 2, fontWeight: 800, fontSize: { xs: 30, md: 44 }, lineHeight: 1.2 }}>
                ให้คนไข้นัดหมายแพทย์ผ่าน LINE ได้ตลอด 24 ชั่วโมง
              </Typography>
              <Typography color="text.secondary" sx={{ mt: 2, maxWidth: 760, lineHeight: 1.8 }}>
                ลดภาระเจ้าหน้าที่ ลดการตอบแชทซ้ำ และบริหารตารางนัดหมายแพทย์ได้อย่างมีประสิทธิภาพด้วยระบบจองคิวคลินิกที่ออกแบบมาสำหรับการใช้งานจริงในคลินิกยุคใหม่
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
                    ทำไมคลินิกจำนวนมากเลือก QueueBooking
                  </Typography>
                  <Stack spacing={1}>
                    {whyChooseItems.map((item) => (
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
          คลินิกของคุณกำลังเจอปัญหาเหล่านี้หรือไม่?
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
            ระบบจองคิวคลินิกผ่าน LINE แบบครบวงจร
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
          {howItWorks.map((step, index) => (
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
            ตัวอย่างการใช้งานสำหรับคลินิกแต่ละประเภท
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
          ประโยชน์ที่คลินิกจะได้รับ
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
          ทำไมคลินิกจึงเลือกใช้ QueueBooking
        </Typography>
        <Grid container spacing={1.5}>
          {whyChooseItems.map((item) => (
            <Grid key={item} size={{ xs: 12, sm: 6 }}>
              <Card sx={{ height: '100%', borderRadius: 2, border: '1px solid', borderColor: 'divider', boxShadow: 'none' }}>
                <CardContent>
                  <Typography fontWeight={700}>{item}</Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Container>

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

      <FaqSection items={faqs} />

      <Container maxWidth="lg" sx={{ pb: 8 }}>
        <Box sx={{ p: { xs: 3, md: 4 }, borderRadius: 3, bgcolor: '#F2F8F4', border: '1px solid #DDEBDD' }}>
          <Typography variant="h4" sx={{ fontWeight: 800, fontSize: { xs: 26, md: 34 } }}>
            เปลี่ยน LINE OA ให้เป็นระบบนัดหมายคลินิกอัตโนมัติ
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 1 }}>
            ให้คนไข้นัดหมายได้ง่ายขึ้น และให้ทีมงานมีเวลามากขึ้นในการดูแลผู้ป่วย
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.2} sx={{ mt: 2.5 }}>
            <Button component={Link} href="/register" variant="contained" sx={{ bgcolor: '#12a862', '&:hover': { bgcolor: '#0a7043' } }}>
              ทดลองใช้งานฟรี
            </Button>
            <Button component={Link} href="/contact" variant="outlined" sx={{ borderColor: '#12a862', color: '#12a862' }}>
              ขอเดโม
            </Button>
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mt: 2.5, flexWrap: 'wrap' }}>
            <Link href="/">หน้าแรก</Link>
            <Link href="/pricing">ดูราคา</Link>
            <Link href="/contact">ติดต่อทีมงาน</Link>
            <Link href="/sandbox-demo">ทดลอง Sandbox</Link>
            <Link href="/solutions/restaurant-booking-system">โซลูชันร้านอาหาร</Link>
            <Link href="/solutions/barbershop-booking-system">โซลูชันร้านตัดผม</Link>
          </Stack>
        </Box>
      </Container>

      <LandingFooter />
    </main>
  );
}
