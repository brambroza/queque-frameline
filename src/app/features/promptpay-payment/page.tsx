import type { Metadata } from 'next';
import Link from 'next/link';
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
import QrCode2RoundedIcon from '@mui/icons-material/QrCode2Rounded';
import BoltRoundedIcon from '@mui/icons-material/BoltRounded';
import SyncRoundedIcon from '@mui/icons-material/SyncRounded';
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded';
import ScienceRoundedIcon from '@mui/icons-material/ScienceRounded';
import VerifiedUserRoundedIcon from '@mui/icons-material/VerifiedUserRounded';
import AccountBalanceRoundedIcon from '@mui/icons-material/AccountBalanceRounded';
import ToggleOnRoundedIcon from '@mui/icons-material/ToggleOnRounded';
import KeyRoundedIcon from '@mui/icons-material/KeyRounded';
import WebhookIcon from '@mui/icons-material/SettingsEthernetRounded';
import CloudDoneRoundedIcon from '@mui/icons-material/CloudDoneRounded';
import { LandingNavbar } from '@/components/public/landing-navbar';
import { LandingFooter } from '@/components/public/landing-footer';
import { FaqSection } from '@/components/public/faq-section';

export const metadata: Metadata = {
  title: 'รับชำระเงินด้วย PromptPay QR Code อัตโนมัติผ่าน LINE | QueueBooking',
  description:
    'เปิดรับชำระเงินมัดจำหรือค่าบริการด้วย PromptPay QR Code อัตโนมัติทันทีที่ลูกค้าจองคิวผ่าน LINE ระบบสร้าง QR ส่งใบเสร็จ และอัปเดตสถานะให้เองทั้งหมด ไม่ต้องเช็คสลิป',
  keywords: [
    'PromptPay QR',
    'รับเงินผ่าน PromptPay',
    'ระบบชำระเงินผ่าน LINE',
    'QR Code รับชำระเงิน',
    'ระบบจองคิวพร้อมชำระเงิน',
    'มัดจำจองคิวออนไลน์',
    'Omise PromptPay',
    'รับชำระเงินอัตโนมัติร้านค้า',
  ],
  alternates: {
    canonical: '/features/promptpay-payment',
    languages: {
      'th-TH': '/features/promptpay-payment',
      'x-default': '/features/promptpay-payment',
    },
  },
  openGraph: {
    title: 'รับชำระเงินด้วย PromptPay QR Code อัตโนมัติผ่าน LINE | QueueBooking',
    description:
      'ลูกค้าจองคิว ระบบสร้าง PromptPay QR ให้ทันที สแกนจ่ายผ่านแอปธนาคารได้ทุกเจ้า พร้อมส่งใบเสร็จอัตโนมัติผ่าน LINE',
    url: '/features/promptpay-payment',
    type: 'website',
    locale: 'th_TH',
  },
};

const heroPills = ['สร้าง QR อัตโนมัติ', 'สแกนจ่ายได้ทุกธนาคาร', 'ยืนยันเงินเข้าอัตโนมัติ', 'ส่งใบเสร็จผ่าน LINE'];

const painPoints = [
  { title: 'ลูกค้าโอนเงินแล้วไม่แจ้ง', desc: 'ต้องคอยถามและรอลูกค้าส่งสลิปเข้ามาเอง' },
  { title: 'พนักงานต้องเช็คสลิปทีละใบ', desc: 'เทียบยอดกับรายการจองด้วยมือ เสี่ยงผิดพลาด' },
  { title: 'ลูกค้าเบี้ยวนัดบ่อย', desc: 'จองแล้วไม่มา เพราะไม่มีการวางมัดจำล่วงหน้า' },
  { title: 'เงินสดปิดร้านไม่ตรง', desc: 'ยอดขายหน้าร้านกับเงินสดในลิ้นชักไม่ match' },
  { title: 'ไม่รู้ว่าใครจ่ายแล้วบ้าง', desc: 'ไม่มีสถานะการชำระเงินในระบบหลังบ้าน' },
  { title: 'ออกใบเสร็จเองทุกครั้ง', desc: 'เสียเวลาทำเอกสารย้อนหลังให้ลูกค้า' },
];

const steps = [
  { title: 'ลูกค้าจองคิวผ่าน LINE', desc: 'เลือกบริการ สาขา และเวลาผ่าน LIFF ตามปกติ' },
  { title: 'ระบบสร้าง QR อัตโนมัติ', desc: 'คำนวณยอดและสร้าง PromptPay QR ทันทีที่จองสำเร็จ' },
  { title: 'ส่ง QR เข้า LINE ทันที', desc: 'ลูกค้าได้รับข้อความพร้อม QR โดยไม่ต้องรอแอดมิน' },
  { title: 'สแกนจ่ายด้วยแอปธนาคาร', desc: 'ใช้แอปธนาคารใดก็ได้ที่รองรับ PromptPay' },
  { title: 'ยืนยันและออกใบเสร็จอัตโนมัติ', desc: 'Webhook อัปเดตสถานะและส่งใบเสร็จกลับใน LINE' },
];

const featureHighlights = [
  { title: 'สร้าง QR อัตโนมัติ', desc: 'ไม่ต้องพิมพ์ยอดเงินเอง ระบบดึงราคาบริการมาคำนวณให้ทันที', icon: BoltRoundedIcon },
  { title: 'เชื่อม Omise PromptPay', desc: 'รองรับสแกนจ่ายผ่านแอปธนาคารได้ทุกเจ้าในไทย', icon: AccountBalanceRoundedIcon },
  { title: 'Test Mode ปลอดภัย', desc: 'ทดลองระบบด้วย Test Key ก่อนใช้งานจริง ไม่มีการตัดเงิน', icon: ScienceRoundedIcon },
  { title: 'อัปเดตสถานะอัตโนมัติ', desc: 'รับแจ้งเตือนผ่าน Webhook ทันทีที่ลูกค้าชำระเงินสำเร็จ', icon: SyncRoundedIcon },
  { title: 'ใบเสร็จส่งผ่าน LINE', desc: 'ลูกค้าได้รับใบเสร็จรับเงินอัตโนมัติหลังจ่ายเสร็จ ไม่ต้องขอ', icon: ReceiptLongRoundedIcon },
  { title: 'แยกคีย์ต่อร้าน ปลอดภัย', desc: 'แต่ละร้านตั้งค่า Omise Key ของตัวเอง เก็บแบบเข้ารหัส', icon: VerifiedUserRoundedIcon },
];

const setupSteps = [
  { title: 'เปิดสวิตช์ QR Payment', desc: 'ไปที่หน้า Payment Settings แล้วเปิดใช้งาน PromptPay', icon: ToggleOnRoundedIcon },
  { title: 'ใส่ Omise API Key', desc: 'เริ่มด้วย Test Key ได้ฟรีเพื่อทดลองระบบก่อน', icon: KeyRoundedIcon },
  { title: 'ตั้งค่า Webhook', desc: 'วาง Webhook URL ใน Omise Dashboard เพื่อรับแจ้งเตือนอัตโนมัติ', icon: WebhookIcon },
  { title: 'สลับเป็น Live Key', desc: 'เปลี่ยนเป็นคีย์จริงเมื่อพร้อมเปิดรับเงินจากลูกค้า', icon: CloudDoneRoundedIcon },
];

const benefits = [
  'ลดปัญหาลูกค้าเบี้ยวนัด',
  'ไม่ต้องเช็คสลิปเอง',
  'กระแสเงินสดชัดเจนขึ้น',
  'ลูกค้าจ่ายสะดวกทุกธนาคาร',
  'ลดงานเอกสารหลังบ้าน',
  'ดูประวัติการชำระเงินได้ในที่เดียว',
];

const faqItems = [
  { q: 'PromptPay QR ในระบบนี้คืออะไร', a: 'คือฟีเจอร์ที่สร้าง QR Code สำหรับรับชำระเงินอัตโนมัติทันทีที่ลูกค้าจองคิวสำเร็จ ลูกค้าสแกนจ่ายผ่านแอปธนาคารได้ทันทีในแชท LINE' },
  { q: 'ต้องมีบัญชี Omise ก่อนหรือไม่', a: 'ต้องมี เพราะระบบเชื่อมต่อการสร้าง QR และตรวจสอบการชำระเงินผ่าน Omise โดยแต่ละร้านตั้งค่า API Key ของตัวเองได้ที่หน้า Payment Settings' },
  { q: 'ทดลองใช้งานก่อนได้หรือไม่', a: 'ได้ ใช้ Test Key ของ Omise เพื่อทดสอบการสร้าง QR และการยืนยันสถานะได้โดยไม่มีการตัดเงินจริง' },
  { q: 'ลูกค้าต้องจ่ายผ่านธนาคารไหน', a: 'สแกนจ่ายได้ด้วยแอปธนาคารที่รองรับ PromptPay แทบทุกเจ้าในประเทศไทย' },
  { q: 'ระบบรู้ได้อย่างไรว่าลูกค้าจ่ายแล้ว', a: 'ระบบรับการแจ้งเตือนแบบเรียลไทม์ผ่าน Webhook จาก Omise แล้วอัปเดตสถานะการจองพร้อมส่งใบเสร็จกลับให้ลูกค้าทันที' },
  { q: 'ถ้าลูกค้าไม่จ่ายภายในเวลาที่กำหนดจะเป็นอย่างไร', a: 'QR จะหมดอายุตามเวลาที่กำหนดและสถานะการจองจะถูกอัปเดตในระบบหลังบ้าน ร้านสามารถติดตามหรือยกเลิกคิวนั้นได้' },
  { q: 'เปิดใช้ฟีเจอร์นี้ยากไหม', a: 'ไม่ยาก เพียงเปิดสวิตช์ในหน้า Payment Settings ใส่ Omise API Key และตั้งค่า Webhook URL ก็เริ่มใช้งานได้ทันที' },
  { q: 'ข้อมูล API Key ปลอดภัยหรือไม่', a: 'ปลอดภัย ระบบเก็บ Secret Key แบบเข้ารหัสและแสดงผลเพียง 4 ตัวท้ายเท่านั้น แต่ละร้านมีคีย์แยกจากกันชัดเจน' },
];

export default function PromptPayPaymentPage() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://queuebooking.com';
  const canonical = `${appUrl}/features/promptpay-payment`;

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqItems.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    })),
  };

  const softwareSchema = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'QueueBooking PromptPay QR Payment',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    inLanguage: ['th'],
    description:
      'ฟีเจอร์รับชำระเงินด้วย PromptPay QR Code อัตโนมัติผ่าน LINE สำหรับระบบจองคิว QueueBooking',
    url: canonical,
    offers: { '@type': 'Offer', priceCurrency: 'THB', availability: 'https://schema.org/InStock' },
  };

  return (
    <main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareSchema) }} />

      <LandingNavbar />

      {/* Hero */}
      <Box
        sx={{
          py: { xs: 7, md: 9 },
          borderBottom: '1px solid',
          borderColor: 'divider',
          background:
            'radial-gradient(circle at top right, rgba(29,78,216,0.12), transparent 32%), linear-gradient(180deg, #ffffff 0%, #fbfcff 100%)',
        }}
      >
        <Container maxWidth="lg">
          <Grid container spacing={4} alignItems="center">
            <Grid size={{ xs: 12, md: 7 }}>
              <Chip
                icon={<QrCode2RoundedIcon sx={{ color: '#1d4ed8 !important' }} />}
                label="ฟีเจอร์ใหม่ • QR Payment"
                sx={{ bgcolor: '#EAF0FE', color: '#1d4ed8', fontWeight: 700 }}
              />
              <Typography variant="h3" sx={{ mt: 2, fontWeight: 800, fontSize: { xs: 30, md: 44 }, lineHeight: 1.2 }}>
                รับเงินอัตโนมัติทันทีที่ลูกค้าจองคิว ด้วย PromptPay QR
              </Typography>
              <Typography color="text.secondary" sx={{ mt: 2, maxWidth: 620, lineHeight: 1.8 }}>
                ไม่ต้องเช็คสลิป ไม่ต้องรอแจ้งโอน ระบบสร้าง QR Code ส่งให้ลูกค้าทันทีในแชท LINE
                สแกนจ่ายได้ทุกธนาคาร แล้วยืนยันเงินเข้าพร้อมออกใบเสร็จให้อัตโนมัติ
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
                    icon={<CheckCircleRoundedIcon sx={{ color: '#1d4ed8 !important' }} />}
                    label={pill}
                    sx={{ bgcolor: '#F0F4FF' }}
                  />
                ))}
              </Stack>
            </Grid>

            <Grid size={{ xs: 12, md: 5 }}>
              <PhoneFrame>
                <PaymentRequestBubble />
              </PhoneFrame>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* Pain points */}
      <Container maxWidth="lg" sx={{ py: 7 }}>
        <Typography variant="h4" sx={{ fontWeight: 800, mb: 0.5 }}>
          ร้านของคุณกำลังปวดหัวเรื่องนี้อยู่หรือไม่?
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          ปัญหาที่พบบ่อยของร้านที่ยังรับเงินสดหรือโอนเงินแบบเช็คสลิปเอง
        </Typography>
        <Grid container spacing={1.5}>
          {painPoints.map((item) => (
            <Grid key={item.title} size={{ xs: 12, sm: 6, md: 4 }}>
              <Card sx={{ height: '100%', borderRadius: 2, border: '1px solid', borderColor: 'divider', boxShadow: 'none' }}>
                <CardContent>
                  <Typography fontWeight={700}>{item.title}</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.6 }}>
                    {item.desc}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Container>

      {/* How it works */}
      <Box sx={{ py: 7, bgcolor: '#FAFBFF', borderTop: '1px solid', borderBottom: '1px solid', borderColor: 'divider' }}>
        <Container maxWidth="lg">
          <Typography variant="h4" sx={{ fontWeight: 800, mb: 0.5 }}>
            การทำงานเบื้องหลัง 5 ขั้นตอน
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 3 }}>
            ตั้งแต่ลูกค้าจองคิวจนถึงเงินเข้าบัญชีร้าน ทุกขั้นตอนเป็นแบบอัตโนมัติ
          </Typography>
          <Grid container spacing={1.5}>
            {steps.map((step, index) => (
              <Grid key={step.title} size={{ xs: 12, sm: 6, md: 4 }}>
                <Card sx={{ height: '100%', borderRadius: 2, border: '1px solid', borderColor: 'divider', boxShadow: 'none' }}>
                  <CardContent>
                    <Typography sx={{ color: '#1d4ed8', fontWeight: 800 }}>Step {index + 1}</Typography>
                    <Typography sx={{ mt: 0.8 }} fontWeight={700}>
                      {step.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.6 }}>
                      {step.desc}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* Showcase — real message mockups */}
      <Container maxWidth="lg" sx={{ py: 7 }}>
        <Typography variant="h4" sx={{ fontWeight: 800, mb: 0.5 }}>
          ข้อความจริงที่ลูกค้าจะได้รับใน LINE
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 4 }}>
          จากขอชำระเงินจนถึงใบเสร็จ ครบในแชทเดียว ไม่ต้องสลับแอป
        </Typography>
        <Grid container spacing={4} justifyContent="center">
          <Grid size={{ xs: 12, sm: 6, md: 5 }} sx={{ display: 'flex', justifyContent: 'center' }}>
            <Stack spacing={1.5} alignItems="center">
              <PhoneFrame small>
                <PaymentRequestBubble />
              </PhoneFrame>
              <Typography fontWeight={700} variant="body2" color="text.secondary">
                1. ขอชำระเงินพร้อม QR ทันทีที่จองสำเร็จ
              </Typography>
            </Stack>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 5 }} sx={{ display: 'flex', justifyContent: 'center' }}>
            <Stack spacing={1.5} alignItems="center">
              <PhoneFrame small>
                <PaymentReceiptBubble />
              </PhoneFrame>
              <Typography fontWeight={700} variant="body2" color="text.secondary">
                2. ใบเสร็จอัตโนมัติหลังชำระสำเร็จ
              </Typography>
            </Stack>
          </Grid>
        </Grid>
      </Container>

      {/* Feature highlights */}
      <Box sx={{ py: 7, bgcolor: '#FAFBFF', borderTop: '1px solid', borderBottom: '1px solid', borderColor: 'divider' }}>
        <Container maxWidth="lg">
          <Typography variant="h4" sx={{ fontWeight: 800, mb: 2 }}>
            ฟีเจอร์เด่นของ QR Payment
          </Typography>
          <Grid container spacing={1.5}>
            {featureHighlights.map((item) => {
              const Icon = item.icon;
              return (
                <Grid key={item.title} size={{ xs: 12, sm: 6, md: 4 }}>
                  <Card sx={{ height: '100%', borderRadius: 2, border: '1px solid', borderColor: 'divider', boxShadow: 'none' }}>
                    <CardContent>
                      <Stack direction="row" spacing={1.2} alignItems="center">
                        <Box sx={{ width: 40, height: 40, borderRadius: 1.5, bgcolor: '#EAF0FE', display: 'grid', placeItems: 'center' }}>
                          <Icon sx={{ color: '#1d4ed8' }} />
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

      {/* Setup steps */}
      <Container maxWidth="lg" sx={{ py: 7 }}>
        <Typography variant="h4" sx={{ fontWeight: 800, mb: 0.5 }}>
          เปิดใช้งานได้ใน 4 ขั้นตอน
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          ตั้งค่าครั้งเดียวที่หน้า Payment Settings ในระบบหลังบ้าน
        </Typography>
        <Grid container spacing={1.5}>
          {setupSteps.map((step, index) => {
            const Icon = step.icon;
            return (
              <Grid key={step.title} size={{ xs: 12, sm: 6, md: 3 }}>
                <Card sx={{ height: '100%', borderRadius: 2, border: '1px solid', borderColor: 'divider', boxShadow: 'none' }}>
                  <CardContent>
                    <Box sx={{ width: 40, height: 40, borderRadius: 1.5, bgcolor: '#EAF0FE', display: 'grid', placeItems: 'center', mb: 1 }}>
                      <Icon sx={{ color: '#1d4ed8' }} />
                    </Box>
                    <Typography sx={{ color: '#1d4ed8', fontWeight: 800, fontSize: 12 }}>ขั้นตอนที่ {index + 1}</Typography>
                    <Typography sx={{ mt: 0.4 }} fontWeight={700}>
                      {step.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.6 }}>
                      {step.desc}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      </Container>

      {/* Benefits */}
      <Box sx={{ py: 7, bgcolor: '#FAFBFF', borderTop: '1px solid', borderBottom: '1px solid', borderColor: 'divider' }}>
        <Container maxWidth="lg">
          <Typography variant="h4" sx={{ fontWeight: 800, mb: 2 }}>
            ประโยชน์ที่ร้านค้าจะได้รับ
          </Typography>
          <Grid container spacing={1.5}>
            {benefits.map((item) => (
              <Grid key={item} size={{ xs: 12, sm: 6, md: 4 }}>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ p: 1.5, borderRadius: 2, bgcolor: '#fff', border: '1px solid', borderColor: 'divider', height: '100%' }}>
                  <CheckCircleRoundedIcon sx={{ color: '#1d4ed8' }} />
                  <Typography>{item}</Typography>
                </Stack>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      <FaqSection items={faqItems} />

      {/* CTA */}
      <Container maxWidth="lg" sx={{ pb: 8 }}>
        <Box sx={{ p: { xs: 3, md: 4 }, borderRadius: 3, bgcolor: '#EEF3FF', border: '1px solid #DCE6FD' }}>
          <Typography variant="h4" sx={{ fontWeight: 800, fontSize: { xs: 26, md: 34 } }}>
            เริ่มรับเงินผ่าน PromptPay QR ได้ตั้งแต่วันนี้
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 1 }}>
            ลดคิวเบี้ยวนัด ลดงานเช็คสลิป และให้ระบบจัดการเรื่องเงินให้ทั้งหมด
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
            <Link href="/use-cases">ตัวอย่างการใช้งาน</Link>
            <Link href="/contact">ติดต่อทีมงาน</Link>
          </Stack>
        </Box>
      </Container>

      <LandingFooter />
    </main>
  );
}

/** Phone-style frame used to display mock LINE chat bubbles */
function PhoneFrame({ children, small }: { children: React.ReactNode; small?: boolean }) {
  const width = small ? 260 : 300;
  return (
    <Box
      sx={{
        width,
        maxWidth: '100%',
        borderRadius: 2,
        bgcolor: '#0b0f16',
        p: '10px',
        boxShadow: '0 24px 60px -20px rgba(15, 23, 42, 0.35)',
      }}
    >
      <Box
        sx={{
          borderRadius: 1.5,
          bgcolor: '#EDEFF3',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            top: 8,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 70,
            height: 16,
            borderRadius: 8,
            bgcolor: '#0b0f16',
            zIndex: 2,
          }}
        />
        <Box sx={{ bgcolor: '#1d4ed8', pt: 4, pb: 1.5, px: 2 }}>
          <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: 13, textAlign: 'center' }}>
            แชทร้านค้า
          </Typography>
        </Box>
        <Box sx={{ p: 1.5, minHeight: small ? 300 : 340, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          {children}
        </Box>
      </Box>
    </Box>
  );
}

/** Mock of the qrPaymentFlex LINE message: request bubble with amount + QR */
function PaymentRequestBubble() {
  return (
    <Card sx={{ borderRadius: 1, overflow: 'hidden', boxShadow: '0 8px 24px -12px rgba(15,23,42,0.25)' }}>
      <Box sx={{ bgcolor: '#1d4ed8', px: 2, py: 1.5 }}>
        <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: 11 }}>ร้านตัวอย่าง QueueBooking</Typography>
        <Typography sx={{ color: '#fff', fontWeight: 800, fontSize: 18, mt: 0.3 }}>ชำระเงิน</Typography>
      </Box>
      <CardContent sx={{ pt: 1.5 }}>
        <Typography fontWeight={800} fontSize={15}>คิว A012</Typography>
        <Typography variant="body2" color="text.secondary">บริการ: ตัดผมชาย</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>สาขา: สาขาหลัก · 14:30</Typography>
        <Box sx={{ borderTop: '1px solid', borderColor: 'divider', pt: 1.5, textAlign: 'center' }}>
          <Typography sx={{ color: '#1d4ed8', fontWeight: 800, fontSize: 22 }}>250.00 บาท</Typography>
          <Box sx={{ display: 'inline-flex', mt: 1.5 }}>
            <PromptPayQrMock />
          </Box>
        </Box>
        <Box sx={{ mt: 1.5, p: 1.2, borderRadius: 2, bgcolor: '#f0fdf4' }}>
          <Typography variant="caption" color="text.secondary" display="block">
            สแกน QR Code ด้วยแอปธนาคารเพื่อชำระเงิน
          </Typography>
          <Typography variant="caption" sx={{ color: '#ef4444' }} display="block">
            หมดอายุ: 15 นาที
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
}

/** Mock of the paymentReceiptFlex LINE message: green receipt bubble */
function PaymentReceiptBubble() {
  return (
    <Card sx={{ borderRadius: 1, overflow: 'hidden', boxShadow: '0 8px 24px -12px rgba(15,23,42,0.25)' }}>
      <Box sx={{ bgcolor: '#16a34a', px: 2, py: 1.5 }}>
        <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: 11 }}>ร้านตัวอย่าง QueueBooking</Typography>
        <Typography sx={{ color: '#fff', fontWeight: 800, fontSize: 18, mt: 0.3 }}>ชำระเงินสำเร็จ</Typography>
      </Box>
      <CardContent sx={{ pt: 1.5, textAlign: 'center' }}>
        <Box
          sx={{
            width: 44,
            height: 44,
            borderRadius: '50%',
            bgcolor: '#f0fdf4',
            display: 'grid',
            placeItems: 'center',
            mx: 'auto',
            mb: 1,
          }}
        >
          <CheckCircleRoundedIcon sx={{ color: '#16a34a', fontSize: 28 }} />
        </Box>
        <Typography fontWeight={800} fontSize={14}>ใบเสร็จรับเงิน</Typography>
        <Typography variant="caption" color="text.secondary" display="block">เลขที่: RC-20260702-A012</Typography>
        <Box sx={{ borderTop: '1px solid', borderColor: 'divider', mt: 1.2, pt: 1.2, textAlign: 'left' }}>
          <Typography variant="body2" fontWeight={700}>คิว A012</Typography>
          <Typography variant="body2" color="text.secondary">บริการ: ตัดผมชาย</Typography>
          <Typography variant="body2" color="text.secondary">สาขา: สาขาหลัก</Typography>
        </Box>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ borderTop: '1px solid', borderColor: 'divider', mt: 1.2, pt: 1.2 }}>
          <Typography fontWeight={700}>ยอดชำระ</Typography>
          <Typography fontWeight={800} sx={{ color: '#16a34a' }}>250.00 บาท</Typography>
        </Stack>
        <Box sx={{ mt: 1.2, p: 1, borderRadius: 2, bgcolor: '#f0fdf4' }}>
          <Typography variant="caption" sx={{ color: '#15803d' }}>ขอบคุณที่ใช้บริการค่ะ</Typography>
        </Box>
      </CardContent>
    </Card>
  );
}

/** Illustrative PromptPay-style QR pattern, built with CSS only (not a scannable code) */
function PromptPayQrMock() {
  const grid = 12;
  const finderSize = 4;

  function zoneOf(r: number, c: number): 'tl' | 'tr' | 'bl' | null {
    if (r < finderSize && c < finderSize) return 'tl';
    if (r < finderSize && c >= grid - finderSize) return 'tr';
    if (r >= grid - finderSize && c < finderSize) return 'bl';
    return null;
  }

  function isFilled(r: number, c: number): boolean {
    const zone = zoneOf(r, c);
    if (zone) {
      const lr = zone === 'bl' ? r - (grid - finderSize) : r;
      const lc = zone === 'tr' ? c - (grid - finderSize) : c;
      return lr === 0 || lr === finderSize - 1 || lc === 0 || lc === finderSize - 1 || (lr === 2 && lc === 2);
    }
    return (r * 5 + c * 3 + (r % 3) * 7) % 9 < 4;
  }

  const cells = Array.from({ length: grid * grid }, (_, i) => {
    const r = Math.floor(i / grid);
    const c = i % grid;
    return isFilled(r, c);
  });

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: `repeat(${grid}, 1fr)`,
        gap: '2px',
        p: 1,
        bgcolor: '#fff',
        border: '1px solid #e5e7eb',
        borderRadius: 2,
        width: 148,
        height: 148,
      }}
    >
      {cells.map((filled, i) => (
        <Box key={i} sx={{ bgcolor: filled ? '#0b1220' : 'transparent', borderRadius: '1px' }} />
      ))}
    </Box>
  );
}
