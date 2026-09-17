'use client';

import Link from 'next/link';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Divider,
  Grid,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import ForumRoundedIcon from '@mui/icons-material/ForumRounded';
import DashboardRoundedIcon from '@mui/icons-material/DashboardRounded';
import SmartToyRoundedIcon from '@mui/icons-material/SmartToyRounded';
import ApartmentRoundedIcon from '@mui/icons-material/ApartmentRounded';
import InsightsRoundedIcon from '@mui/icons-material/InsightsRounded';
import QrCode2RoundedIcon from '@mui/icons-material/QrCode2Rounded';
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded';
import { alpha, type Theme } from '@mui/material/styles';
import { features, pricingPlans, testimonials, useCases as useCaseCards } from './content';

/** สไตล์ chip แบรนด์ (soft) — theme-aware รองรับ light/dark */
const brandChipSx = (theme: Theme) => ({
  bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.2 : 0.14),
  color: theme.palette.mode === 'dark' ? theme.palette.primary.light : theme.palette.primary.dark,
  fontWeight: 600,
});

/** พื้นหลัง section — light ใช้ค่าที่ออกแบบไว้, dark สลับเป็น paper/bg ของ theme */
const sectionBg = (bg: string) => (theme: Theme) =>
  theme.palette.mode === 'dark'
    ? bg === '#fff'
      ? theme.palette.background.paper
      : theme.palette.background.default
    : bg;

const painCards = [
  { title: 'ลูกค้าทักถามคิวซ้ำ ๆ', desc: 'พนักงานต้องตอบข้อความเดิมซ้ำหลายสิบครั้งต่อวัน เสียเวลามาก', color: '#E24B4A' },
  { title: 'พนักงานตอบแชทไม่ทัน', desc: 'ลูกค้ารอนาน ได้รับประสบการณ์ที่ไม่ดี อาจยกเลิกไปใช้เจ้าอื่น', color: '#BA7517' },
  { title: 'คิวชนกันหรือจองซ้ำ', desc: 'จัดการคิวด้วยมือเกิดข้อผิดพลาด ลูกค้าผิดหวังและเสียโอกาส', color: '#D85A30' },
  { title: 'จัดการหลายสาขายาก', desc: 'ข้อมูลกระจัดกระจาย ไม่สามารถดูภาพรวมธุรกิจทั้งหมดได้', color: '#7F77DD' },
  { title: 'ไม่มีรายงานจำนวนคิว', desc: 'ไม่รู้ช่วงเวลาไหนคนเยอะ วางแผนพนักงานและบริการได้ยาก', color: '#1D9E75' },
  { title: 'ลูกค้าลืมนัดหรือไม่มา', desc: 'ไม่มีระบบแจ้งเตือน ทำให้คิวว่างโดยไม่ได้รับแจ้งล่วงหน้า', color: '#D4537E' },
];

const solutionCards = [
  { title: 'ลูกค้าถามคิวผ่าน LINE', desc: 'ตอบกลับอัตโนมัติทันที ไม่ต้องใช้พนักงาน', icon: <ForumRoundedIcon sx={{ color: '#12a862' }} />, bg: '#EAF3DE' },
  { title: 'จองคิวผ่าน LIFF', desc: 'เปิดหน้าจองในแอป LINE ได้เลย สะดวกมาก', icon: <DashboardRoundedIcon sx={{ color: '#378ADD' }} />, bg: '#E6F1FB' },
  { title: 'ตอบกลับอัตโนมัติ', desc: 'Chatbot ตอบ 24/7 ไม่มีวันหยุด', icon: <SmartToyRoundedIcon sx={{ color: '#534AB7' }} />, bg: '#EEEDFE' },
  { title: 'จัดการคิวหลังบ้าน', desc: 'Dashboard ครบ ดู แก้ ยกเลิก คิวได้ทันที', icon: <DashboardRoundedIcon sx={{ color: '#12a862' }} />, bg: '#EAF3DE' },
  { title: 'รองรับหลายสาขา', desc: 'บริหารหลายร้านหลายสาขาในที่เดียว', icon: <ApartmentRoundedIcon sx={{ color: '#854F0B' }} />, bg: '#FAEEDA' },
  { title: 'รายงานและสถิติ', desc: 'วิเคราะห์ข้อมูลเพื่อพัฒนาธุรกิจ', icon: <InsightsRoundedIcon sx={{ color: '#A32D2D' }} />, bg: '#FCEBEB' },
];

const mockCaseStudies = [
  {
    business: 'คลินิกความงาม (1 สาขา)',
    before: 'ลูกค้าถามคิวหัตถการช่วงเย็นพร้อมกัน แอดมินตอบไม่ทันและมีคิวซ้อน',
    after: 'ลูกค้าเลือกบริการและเวลาว่างผ่าน LINE ได้เอง ทีมงานเห็นคิวรวมใน Dashboard ทันที',
    outcomes: ['เวลาตอบแชทลดลง 60%', 'no-show ลดลง 27%', 'จำนวนคิวต่อวันเพิ่มจาก 32 เป็น 44'],
  },
  {
    business: 'ร้านตัดผมชาย (2 สาขา)',
    before: 'เสาร์-อาทิตย์หน้าร้านแน่น ลูกค้าทักถามคิวซ้ำและพนักงานจัดลำดับคิวยาก',
    after: 'ลูกค้าจองล่วงหน้าและรับบัตรคิวผ่าน LINE ส่วนหน้าร้านดูคิวสดบน Queue Board',
    outcomes: ['เวลารอหน้าร้านลดลง 34%', 'คิวซ้ำลดลง 41%', 'คิวสำเร็จต่อวันเพิ่มขึ้น 19%'],
  },
  {
    business: 'ร้านบุฟเฟ่ต์ (3 สาขา)',
    before: 'การจองรอบโต๊ะไม่สัมพันธ์กับความจุจริง ทำให้รอคิวนานและเสียรอบขายพีค',
    after: 'ระบบล็อกจำนวนที่นั่งต่อรอบและเปิดจองผ่าน LINE พร้อมแจ้งเตือนก่อนถึงเวลา',
    outcomes: ['อัตราเติมที่นั่งต่อรอบเพิ่มขึ้น 23%', 'เวลารอเฉลี่ยลดจาก 45 นาทีเหลือ 28 นาที', 'ยอดจองล่วงหน้าผ่าน LINE อยู่ที่ 66%'],
  },
];

export function HeroSection() {
  return (
    <Box sx={{ bgcolor: 'background.paper', py: { xs: 5, md: 10 }, borderBottom: '1px solid', borderColor: 'divider', overflow: 'hidden' }}>
      <Container maxWidth="lg">
        <Grid container spacing={{ xs: 4, md: 4 }} alignItems="center">
          <Grid size={{ xs: 12, md: 7 }} sx={{ minWidth: 0 }}>
            <Stack alignItems={{ xs: 'center', md: 'flex-start' }} sx={{ width: '100%', maxWidth: '100%', textAlign: { xs: 'center', md: 'left' } }}>
              <Chip label="ระบบจองคิวผ่าน LINE OA" sx={brandChipSx} />
              <Typography
                component="h1"
                sx={{ mt: 2, width: '100%', fontSize: { xs: 30, sm: 38, md: 46 }, lineHeight: 1.18, fontWeight: 800, letterSpacing: '-0.01em', textWrap: 'balance' }}
              >
                ลูกค้าจองคิวผ่าน{' '}
                <Box component="span" sx={{ color: 'primary.main' }}>LINE</Box>
                {' '}ได้เอง
              </Typography>
              <Stack
                direction="row"
                useFlexGap
                flexWrap="wrap"
                spacing={1}
                justifyContent={{ xs: 'center', md: 'flex-start' }}
                sx={{ mt: 2.5, width: '100%' }}
              >
                {['แจ้งเตือนอัตโนมัติ', 'เรียกคิวผ่านจอได้', 'ลด no-show', 'ใช้ได้หลายสาขา'].map((c) => (
                  <Chip key={c} label={c} size="small" sx={brandChipSx} />
                ))}
              </Stack>
              <Typography color="text.secondary" sx={{ mt: 2.5, width: '100%', maxWidth: 560, lineHeight: 1.8 }}>
                ให้ลูกค้าถามคิวว่างและจองคิวได้ง่ายผ่าน LINE พร้อมระบบหลังบ้านสำหรับจัดการร้าน สาขา บริการ คิว พนักงาน และรายงานครบในที่เดียว
              </Typography>
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                useFlexGap
                flexWrap="wrap"
                spacing={1.2}
                alignItems={{ xs: 'stretch', sm: 'center' }}
                sx={{ mt: 3, width: '100%' }}
              >
                <Button component={Link} href="/register" variant="contained" size="large" sx={{ width: { xs: '100%', sm: 'auto' } }}>
                  เริ่มใช้งานฟรี
                </Button>
                <Button component={Link} href="/pricing" variant="outlined" size="large" sx={{ width: { xs: '100%', sm: 'auto' } }}>
                  ดูแผนราคา
                </Button>
                <Stack direction="row" spacing={0.5} justifyContent="center" sx={{ width: { xs: '100%', sm: 'auto' } }}>
                  <Button component={Link} href="/contact" color="inherit">ติดต่อเรา</Button>
                  <Button component={Link} href="/blog" color="inherit">อ่านบทความ</Button>
                </Stack>
              </Stack>
              <Stack
                direction="row"
                useFlexGap
                flexWrap="wrap"
                spacing={1.5}
                rowGap={1}
                justifyContent={{ xs: 'center', md: 'flex-start' }}
                sx={{ mt: 3, width: '100%' }}
              >
                {['Starter ฟรี', '50 คิว/เดือน', 'ตั้งค่าง่ายใน 5 นาที'].map((x) => (
                  <Stack key={x} direction="row" spacing={0.8} alignItems="center">
                    <CheckCircleRoundedIcon sx={{ color: 'primary.main', fontSize: 18 }} />
                    <Typography variant="body2" color="text.secondary">{x}</Typography>
                  </Stack>
                ))}
              </Stack>
            </Stack>
          </Grid>

          {/*    <Grid size={{ xs: 12, md: 5 }}>
            <Stack direction="row" spacing={1.5} alignItems="end">
              <Paper sx={{ p: 1.5, borderRadius: 1, flex: 1, border: '1px solid', borderColor: 'divider', boxShadow: '0 10px 28px rgba(15,23,42,0.06)' }}>
                <Typography variant="caption" color="text.secondary">Dashboard</Typography>
                <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                  <Box sx={{ flex: 1, bgcolor: '#EAF3DE', borderRadius: 1, p: 1.2, textAlign: 'center' }}><Typography fontWeight={700} color="#0a7043">48</Typography><Typography variant="caption">คิววันนี้</Typography></Box>
                  <Box sx={{ flex: 1, bgcolor: '#E6F1FB', borderRadius: 1, p: 1.2, textAlign: 'center' }}><Typography fontWeight={700} color="#185FA5">12</Typography><Typography variant="caption">รอดำเนินการ</Typography></Box>
                </Stack>
                <Box sx={{ mt: 1, p: 1.2, bgcolor: '#F1EFE8', borderRadius: 2 }}>
                  <Typography variant="caption" color="text.secondary">คิวถัดไป</Typography>
                  <Typography variant="body2" fontWeight={600}>คุณสมชาย ใจดี</Typography>
                  <Typography variant="caption" color="text.secondary">ตัดผม 09:30</Typography>
                </Box>
              </Paper>
              <Box sx={{ width: 165, bgcolor: '#06C755', borderRadius: 1, p: 1.5, color: '#fff', boxShadow: '0 10px 28px rgba(6,199,85,0.28)' }}>
                <Typography fontWeight={700} variant="caption">LINE Chat</Typography>
                <Box sx={{ mt: 1, bgcolor: 'rgba(255,255,255,0.2)', borderRadius: '10px 10px 2px 10px', p: 1, fontSize: 12 }}>คิวว่างวันนี้มีไหมครับ?</Box>
                <Box sx={{ mt: 0.8, bgcolor: 'rgba(255,255,255,0.92)', color: '#333', borderRadius: '2px 10px 10px 10px', p: 1, fontSize: 12 }}>มีว่าง 2 ช่วง เลือกเวลาได้เลยค่ะ</Box>
                <Stack spacing={0.6} sx={{ mt: 1 }}>{['09:30 น.', '11:00 น.'].map((x) => <Box key={x} sx={{ bgcolor: '#fff', borderRadius: 1.5, textAlign: 'center', color: '#06C755', py: 0.5, fontWeight: 700, fontSize: 12 }}>{x}</Box>)}</Stack>
              </Box>
            </Stack>
          </Grid> */}

          <Grid size={{ xs: 12, md: 5 }} sx={{ minWidth: 0, width: '100%' }}>
            <Stack
              direction="row"
              spacing={1.5}
              alignItems="flex-start"
              justifyContent={{ xs: 'flex-start', md: 'flex-start' }}
              sx={{
                width: '100%',
                // ล็อกกับ viewport โดยตรง กัน flex min-width ดันความกว้างเกินจอ
                maxWidth: { xs: 'calc(100vw - 32px)', md: '100%' },
                overflowX: 'auto',
                px: 0.5,
                pb: 1,
                scrollSnapType: 'x mandatory',
                scrollbarWidth: 'none',
                '&::-webkit-scrollbar': { display: 'none' },
              }}
            >
              
              <Box
                sx={{
                  flex: '0 0 auto',
                  width: { xs: 150, sm: 165 },
                  p: 0.8,
                  borderRadius: 2.5,
                  border: '1px solid',
                  borderColor: 'divider',
                  boxShadow: 'var(--shadow-pop)',
                  bgcolor: 'background.paper',
                  scrollSnapAlign: 'start',
                }}
              >
                <Box
                  component="img"
                  src="/images/landing/1.jpg"
                  alt="ตัวอย่างหน้าเลือกวันเวลาและช่วงเวลาจอง"
                  sx={{
                    width: '100%',
                    height: 270,
                    display: 'block',
                    objectFit: 'cover',
                    objectPosition: 'top center',
                    borderRadius: 1,
                    border: '1px solid',
                    borderColor: 'divider',
                  }}
                />
              </Box>

              <Box
                sx={{
                  flex: '0 0 auto',
                  width: { xs: 150, sm: 165 },
                  p: 0.8,
                  borderRadius: 2.5,
                  border: '1px solid',
                  borderColor: 'divider',
                  boxShadow: 'var(--shadow-pop)',
                  bgcolor: 'background.paper',
                  scrollSnapAlign: 'start',
                }}
              >
                <Box
                  component="img"
                  src="/images/landing/2.jpg"
                  alt="ตัวอย่างหน้าเลือกวันเวลาและช่วงเวลาจอง"
                  sx={{
                    width: '100%',
                    height: 270,
                    display: 'block',
                    objectFit: 'cover',
                    objectPosition: 'top center',
                    borderRadius: 1,
                    border: '1px solid',
                    borderColor: 'divider',
                  }}
                />
              </Box>

              <Box
                sx={{
                  flex: '0 0 auto',
                  width: { xs: 150, sm: 165 },
                  p: 0.8,
                  borderRadius: 2.5,
                  border: '1px solid',
                  borderColor: 'divider',
                  boxShadow: 'var(--shadow-pop)',
                  bgcolor: 'background.paper',
                  scrollSnapAlign: 'start',
                }}
              >
                <Box
                  component="img"
                  src="/images/use-cases/barber/signage-desktop.jpg"
                  alt="ตัวอย่างหน้าเลือกวันเวลาและช่วงเวลาจอง"
                  sx={{
                    width: '100%',
                    height: 270,
                    display: 'block',
                    objectFit: 'cover',
                    objectPosition: 'top center',
                    borderRadius: 1,
                    border: '1px solid',
                    borderColor: 'divider',
                  }}
                />
              </Box>
            </Stack>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
}

export function StatsSection() {
  const stats = [['500+', 'ร้านค้าที่ใช้งาน'], ['50,000+', 'การจองต่อเดือน'], ['99.9%', 'Uptime'], ['4.9 ★', 'คะแนนเฉลี่ย']];
  return (
    <Box sx={{ bgcolor: sectionBg('#f8faf9'), py: 2.5, borderBottom: '1px solid', borderColor: 'divider' }}>
      <Container maxWidth="lg">
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          divider={<Divider orientation="vertical" flexItem />}
          spacing={1.5}
          justifyContent="center"
          alignItems="center"
        >
          {stats.map(([n, l]) => (
            <Box key={l} sx={{ textAlign: 'center', px: { xs: 1, md: 3 }, py: 0.6 }}>
              <Typography sx={{ fontSize: 26, fontWeight: 700, color: '#12a862', lineHeight: 1.1 }}>{n}</Typography>
              <Typography variant="caption" color="text.secondary">{l}</Typography>
            </Box>
          ))}
        </Stack>
      </Container>
    </Box>
  );
}

export function PainPointSection() {
  return (
    <SectionWrap id="pain-points" title="ปัญหาที่ร้านค้าพบเจอทุกวัน" sub="ถ้าคุณเจอปัญหาเหล่านี้ เราช่วยได้" tag="ปัญหาที่พบ" bg="#f6f7f9">
      <Grid container spacing={2}>
        {painCards.map((p) => (
          <Grid key={p.title} size={{ xs: 12, md: 4 }}>
            <Card sx={{ borderRadius: 1, height: '100%' }}><CardContent><Box sx={{ width: 10, height: 10, borderRadius: 10, bgcolor: p.color, mb: 1 }} /><Typography fontWeight={700}>{p.title}</Typography><Typography variant="body2" color="text.secondary" sx={{ mt: 0.8 }}>{p.desc}</Typography></CardContent></Card>
          </Grid>
        ))}
      </Grid>
    </SectionWrap>
  );
}

export function SolutionSection() {
  return (
    <SectionWrap id="features" title="จัดการคิวทั้งหมดผ่านระบบเดียว" sub="ระบบครบวงจรเชื่อมต่อ LINE OA ของคุณโดยตรง" tag="โซลูชัน" bg="#fff">
      <Grid container spacing={2}>
        {solutionCards.map((s) => (
          <Grid key={s.title} size={{ xs: 12, md: 4 }}>
            <Paper sx={{ p: 2, borderRadius: 1, height: '100%', border: '1px solid', borderColor: 'divider' }}>
              <Stack direction="row" spacing={1.4} alignItems="flex-start">
                <Box sx={{ width: 40, height: 40, borderRadius: 2.5, bgcolor: s.bg, display: 'grid', placeItems: 'center' }}>{s.icon}</Box>
                <Box><Typography fontWeight={700}>{s.title}</Typography><Typography variant="body2" color="text.secondary">{s.desc}</Typography></Box>
              </Stack>
            </Paper>
          </Grid>
        ))}
      </Grid>
    </SectionWrap>
  );
}

/** A compact preview of the PromptPay flow, with the QR and receipt shown as LINE messages. */
export function PromptPayShowcaseSection() {
  return (
    <Box sx={{ py: 8, bgcolor: sectionBg('#F7FAFF'), borderTop: '1px solid', borderBottom: '1px solid', borderColor: 'divider' }}>
      <Container maxWidth="lg">
        <Grid container spacing={{ xs: 4, md: 6 }} alignItems="center">
          <Grid size={{ xs: 12, md: 5 }}>
            <Box sx={{ width: 44, height: 44, borderRadius: 2, bgcolor: '#EAF0FE', display: 'grid', placeItems: 'center', mb: 2 }}>
              <QrCode2RoundedIcon sx={{ color: '#1D4ED8' }} />
            </Box>
            <Typography sx={{ fontSize: { xs: 28, md: 38 }, lineHeight: 1.2, fontWeight: 800 }}>
              รับมัดจำผ่าน PromptPay QR ได้ทันทีใน LINE
            </Typography>
            <Typography color="text.secondary" sx={{ mt: 1.5, lineHeight: 1.8 }}>
              เมื่อลูกค้าจองคิว ระบบจะส่ง QR Code พร้อมยอดชำระให้ทันที สแกนจ่ายได้ทุกธนาคาร แล้วระบบยืนยันเงินเข้าและส่งใบเสร็จให้อัตโนมัติ
            </Typography>
            <Stack spacing={1} sx={{ mt: 2.5 }}>
              {['สร้าง QR ตามยอดบริการอัตโนมัติ', 'ลดงานเช็คสลิปและลดคิวเบี้ยวนัด', 'อัปเดตสถานะการจองทันทีเมื่อชำระสำเร็จ'].map((item) => (
                <Stack key={item} direction="row" spacing={1} alignItems="center">
                  <CheckCircleRoundedIcon sx={{ color: '#1D4ED8', fontSize: 20 }} />
                  <Typography variant="body2">{item}</Typography>
                </Stack>
              ))}
            </Stack>
            <Button component={Link} href="/features/promptpay-payment" variant="outlined" sx={{ mt: 3, borderColor: '#1D4ED8', color: '#1D4ED8', '&:hover': { borderColor: '#1E40AF', bgcolor: '#EEF3FF' } }}>
              ดูรายละเอียด QR Payment
            </Button>
          </Grid>
          <Grid size={{ xs: 12, md: 7 }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="center" alignItems="center">
              <PaymentPhone label="1. ลูกค้าได้รับ QR หลังจองคิว">
                {/*  <PaymentQrMessage /> */}
                <Box
                  component="img"
                  src="/images/landing/p1.jpg"
                  alt="ตัวอย่างหน้าเลือกวันเวลาและช่วงเวลาจอง"
                  sx={{
                    width: '100%',
                    height: 420,
                    display: 'block',
                    objectFit: 'cover',
                    objectPosition: 'top center',
                    borderRadius: 0.7,
                    border: '1px solid',
                    borderColor: 'divider',
                  }}
                />
              </PaymentPhone>
              <PaymentPhone label="2. ร้านและลูกค้าได้รับการยืนยัน">
                {/*    <PaymentReceiptMessage /> */}
                <Box
                  component="img"
                  src="/images/landing/p2.jpg"
                  alt="ตัวอย่างหน้าเลือกวันเวลาและช่วงเวลาจอง"
                  sx={{
                    width: '100%',
                    height: 290,
                    display: 'block',
                    objectFit: 'cover',
                    objectPosition: 'top center',
                    borderRadius: 1,
                    border: '1px solid',
                    borderColor: 'divider',
                  }}
                />
              </PaymentPhone>
            </Stack>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
}

function PaymentPhone({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <Stack spacing={1.1} alignItems="center">
      <Box sx={{ width: 236, borderRadius: 1,   p: '8px', boxShadow: '0 22px 45px -22px rgba(15,23,42,.42)' }}>
        <Box sx={{ overflow: 'hidden', borderRadius: 0.8, bgcolor: '#EEF1F5' }}>
          <Box sx={{ bgcolor: '#1D4ED8', px: 1.5, py: 1.1 }}>
            <Typography color="#fff" fontWeight={700} fontSize={12} textAlign="center">แชทร้านค้า</Typography>
          </Box>
          <Box sx={{ p: 1.2, minHeight: 444, display: 'flex', alignItems: 'flex-end' }}>{children}</Box>
        </Box>
      </Box>
      <Typography variant="body2" fontWeight={700} color="text.secondary" textAlign="center">{label}</Typography>
    </Stack>
  );
}

function PaymentQrMessage() {
  return (
    <Card sx={{ width: '100%', borderRadius: 1.5, boxShadow: '0 8px 20px -12px rgba(15,23,42,.35)' }}>
      <Box sx={{ bgcolor: '#1D4ED8', px: 1.3, py: 1 }}><Typography color="#fff" fontWeight={800} fontSize={15}>ชำระเงิน</Typography></Box>
      <CardContent sx={{ p: '12px !important', textAlign: 'center' }}>
        <Typography fontWeight={800} fontSize={13} textAlign="left">คิว A012 · ตัดผมชาย</Typography>
        <Typography color="#1D4ED8" fontWeight={800} fontSize={20} sx={{ my: 1 }}>250.00 บาท</Typography>
        <PromptPayQrPreview />
        <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 1 }}>สแกนด้วยแอปธนาคารเพื่อชำระเงิน</Typography>
      </CardContent>
    </Card>
  );
}

function PaymentReceiptMessage() {
  return (
    <Card sx={{ width: '100%', borderRadius: 1.5, boxShadow: '0 8px 20px -12px rgba(15,23,42,.35)' }}>
      <Box sx={{ bgcolor: '#16A34A', px: 1.3, py: 1 }}><Typography color="#fff" fontWeight={800} fontSize={15}>ชำระเงินสำเร็จ</Typography></Box>
      <CardContent sx={{ p: '12px !important', textAlign: 'center' }}>
        <ReceiptLongRoundedIcon sx={{ color: '#16A34A', fontSize: 34 }} />
        <Typography fontWeight={800} fontSize={14}>ใบเสร็จรับเงิน</Typography>
        <Typography variant="caption" color="text.secondary">คิว A012 · ตัดผมชาย</Typography>
        <Divider sx={{ my: 1.2 }} />
        <Stack direction="row" justifyContent="space-between"><Typography variant="body2" fontWeight={700}>ยอดชำระ</Typography><Typography variant="body2" fontWeight={800} color="#16A34A">250.00 บาท</Typography></Stack>
        <Box sx={{ mt: 1.2, py: .8, borderRadius: 1.5, bgcolor: '#F0FDF4' }}><Typography variant="caption" color="#15803D">ส่งใบเสร็จให้แล้วใน LINE</Typography></Box>
      </CardContent>
    </Card>
  );
}

function PromptPayQrPreview() {
  const cells = Array.from({ length: 100 }, (_, index) => (index * 7 + Math.floor(index / 10) * 3) % 8 < 3);
  return (
    <Box sx={{ width: 104, height: 104, mx: 'auto', p: .65, bgcolor: '#fff', border: '1px solid #E5E7EB', borderRadius: 1, display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: '2px' }}>
      {cells.map((filled, index) => <Box key={index} sx={{ bgcolor: filled ? '#111827' : 'transparent' }} />)}
    </Box>
  );
}

export function ShowcaseSection() {
  return (
    <SectionWrap id="showcase" title="ใช้ได้กับหลายธุรกิจ" sub="รองรับทุกรูปแบบการนัดหมายและจองคิว" tag="Use Cases" bg="#f6f7f9">
      <Grid container spacing={1.5}>
        {useCaseCards.map((item) => {
          const Icon = item.icon;
          return (
            <Grid key={item.slug} size={{ xs: 6, md: 3 }}>
              <Card sx={{ textAlign: 'center', borderRadius: 1 }}>
                <CardContent sx={{ py: 2.2 }}>
                  <Icon sx={{ fontSize: 30, color: '#12a862' }} />
                  <Typography fontWeight={700} sx={{ fontSize: 14, mt: 0.6 }}>{item.title}</Typography>
                  <Typography variant="caption" color="text.secondary">{item.mode}</Typography>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>
      <Stack alignItems="center" sx={{ mt: 2.5 }}>
        <Button component={Link} href="/use-cases" variant="outlined" sx={{ borderColor: '#12a862', color: '#12a862' }}>
          ดูตัวอย่างธุรกิจทั้งหมด
        </Button>
      </Stack>
    </SectionWrap>
  );
}

export function FeatureSection() {
  return (
    <SectionWrap title="ฟีเจอร์หลักของระบบ" sub="ครบทุกอย่างที่ต้องการสำหรับการจัดการคิวมืออาชีพ" tag="ฟีเจอร์" bg="#fff">
      <Grid container spacing={1.5}>
        {features.map((f) => (
          <Grid key={f} size={{ xs: 6, md: 3 }}>
            <Paper sx={{ p: 1.5, borderRadius: 1.5, border: '1px solid', borderColor: 'divider' }}>
              <Typography sx={{ fontSize: 13 }}>{f}</Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>
    </SectionWrap>
  );
}

export function HowItWorksSection() {
  const steps = ['สมัครใช้งานและสร้างร้านค้า', 'ตั้งค่าสาขา บริการ เวลาทำการ และเชื่อม LINE OA', 'ให้ลูกค้าจองคิวผ่าน LINE และจัดการผ่าน Dashboard'];
  return (
    <SectionWrap title="เริ่มใช้งานง่ายใน 3 ขั้นตอน" sub="ระบบออกแบบให้เริ่มได้รวดเร็ว" tag="How it works" bg="#f6f7f9">
      <Grid container spacing={2}>{steps.map((s, i) => <Grid key={s} size={{ xs: 12, md: 4 }}><Card sx={{ borderRadius: 1, height: '100%' }}><CardContent><Chip label={`Step ${i + 1}`} sx={brandChipSx} /><Typography sx={{ mt: 1.2 }}>{s}</Typography></CardContent></Card></Grid>)}</Grid>
    </SectionWrap>
  );
}

export function PricingPreviewSection() {
  return (
    <SectionWrap id="pricing" title="เลือกแผนที่เหมาะกับธุรกิจของคุณ" sub="มีทั้งแพ็กเกจมาตรฐานและแบบ Custom สำหรับร้านอาหาร บุฟเฟ่ต์ และห้องประชุม" tag="Pricing" bg="#fff">
      <Grid container spacing={2}>
        {pricingPlans.map((p) => (
          <Grid key={p.name} size={{ xs: 12, sm: 6, md: 3 }}>
            <Card sx={{ borderRadius: 1, border: p.highlight ? '2px solid #12a862' : undefined, height: '100%' }}>
              <CardContent>
                <Typography fontWeight={700}>{p.name}</Typography>
                <Stack direction="row" alignItems="baseline" spacing={0.5} sx={{ mt: 0.5 }}>
                  <Typography sx={{ fontSize: 34, fontWeight: 800 }}>{p.price}</Typography>
                  {p.period && <Typography variant="caption" color="text.secondary">{p.period}</Typography>}
                </Stack>
                <Typography variant="caption" color="text.secondary">{p.desc}</Typography>
                <Divider sx={{ my: 1.2 }} />
                <Stack spacing={0.5}>{p.items.map((x) => <Typography key={x} variant="body2">• {x}</Typography>)}</Stack>
                <Button
                  component={Link}
                  href={p.contactSales ? '/contact' : `/register?plan=${encodeURIComponent(p.name)}`}
                  variant="contained"
                  fullWidth
                  sx={{ mt: 2, bgcolor: '#12a862', '&:hover': { bgcolor: '#0a7043' } }}
                >
                  {p.contactSales ? 'ขอใบเสนอราคา' : 'เริ่มใช้งาน'}
                </Button>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </SectionWrap>
  );
}

export function TestimonialSection() {
  return (
    <SectionWrap title="ร้านค้าที่ใช้ระบบจัดการคิวได้ง่ายขึ้น" sub="เสียงตอบรับจากธุรกิจบริการ" tag="Testimonials" bg="#f6f7f9">
      <Grid container spacing={2}>{testimonials.map((t) => <Grid key={t.name} size={{ xs: 12, md: 4 }}><Card sx={{ borderRadius: 1, height: '100%' }}><CardContent><Typography>“{t.quote}”</Typography><Typography fontWeight={700} sx={{ mt: 1.2 }}>{t.name}</Typography><Typography variant="caption" color="text.secondary">{t.type}</Typography></CardContent></Card></Grid>)}</Grid>
    </SectionWrap>
  );
}

export function MockCaseStudySection() {
  return (
    <SectionWrap
      title="เปรียบเทียบ ก่อนใช้ และหลังใช้ระบบ"
      sub="เปรียบเทียบแบบแชทสั้น ๆ ก่อนใช้และหลังใช้ระบบ เพื่อเห็นภาพเร็ว"
      tag="Case Study"
      bg="#fff"
    >
      <Grid container spacing={2}>
        {mockCaseStudies.map((item) => (
          <Grid key={item.business} size={{ xs: 12, md: 4 }}>
            <Card sx={{ borderRadius: 1, height: '100%', border: '1px solid', borderColor: 'divider', boxShadow: 'none' }}>
              <CardContent>
                <Typography fontWeight={800} sx={{ mb: 1.2 }}>{item.business}</Typography>
                <Stack spacing={1}>
                  <Box sx={{ maxWidth: '92%', bgcolor: '#F4F6F8', color: '#1f2937', px: 1.2, py: 0.9, borderRadius: '12px 12px 12px 4px' }}>
                    <Typography variant="caption" sx={{ color: '#6b7280', display: 'block', mb: 0.3 }}>ก่อนใช้ระบบ</Typography>
                    <Typography variant="body2">{item.before}</Typography>
                  </Box>
                  <Box sx={{ ml: 'auto', maxWidth: '92%', bgcolor: '#EAF3DE', color: '#23410a', px: 1.2, py: 0.9, borderRadius: '12px 12px 4px 12px' }}>
                    <Typography variant="caption" sx={{ color: '#3b6d11', display: 'block', mb: 0.3 }}>หลังใช้ระบบ</Typography>
                    <Typography variant="body2">{item.after}</Typography>
                  </Box>
                </Stack>
                <Divider sx={{ my: 1.2 }} />
                <Typography variant="body2" fontWeight={700} sx={{ mb: 0.6 }}>ผลลัพธ์ที่คาดหวัง</Typography>
                <Stack spacing={0.4}>
                  {item.outcomes.map((x) => (
                    <Typography key={x} variant="body2">• {x}</Typography>
                  ))}
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
        หมายเหตุ: ตัวเลขในส่วนนี้เป็นข้อมูลจำลอง (Mock) สำหรับใช้ประเมินภาพรวมและวางแผนการใช้งานเบื้องต้น
      </Typography>
    </SectionWrap>
  );
}

export function CtaSection() {
  return (
    <Container id="contact" maxWidth="lg" sx={{ py: 8, scrollMarginTop: '96px' }}>
      <Paper
        sx={{
          p: { xs: 3, md: 5 },
          borderRadius: 1,
          border: '1px solid',
          borderColor: 'divider',
          background: (theme) =>
            theme.palette.mode === 'dark'
              ? `linear-gradient(135deg, ${theme.palette.background.paper} 0%, ${alpha(theme.palette.primary.main, 0.12)} 100%)`
              : 'linear-gradient(135deg,#ffffff 0%,#f6fbf8 100%)',
          boxShadow: '0 14px 40px rgba(15,23,42,0.06)',
        }}
      >
        <Stack spacing={2}>
          <Box
            sx={{
              width: 'fit-content',
              px: 1.4,
              py: 0.5,
              borderRadius: 10,
              bgcolor: '#EAF3DE',
              color: '#0a7043',
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            พร้อมเริ่มใช้งาน
          </Box>

          <Typography sx={{ fontSize: { xs: 28, md: 38 }, lineHeight: 1.2, fontWeight: 800 }}>
            พร้อมให้ลูกค้าจองคิวผ่าน LINE แล้วหรือยัง?
          </Typography>

          <Typography color="text.secondary" sx={{ maxWidth: 680 }}>
            เริ่มต้นสร้างระบบจองคิวของร้านคุณได้ภายในไม่กี่นาที ลดงานตอบแชทซ้ำ และจัดการคิวได้เป็นระบบมากขึ้นทันที
          </Typography>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.2} sx={{ pt: 0.5 }}>
            <Button component={Link} href="/register" variant="contained" sx={{ bgcolor: '#12a862', '&:hover': { bgcolor: '#0a7043' } }}>
              เริ่มใช้งานฟรี
            </Button>
            <Button component={Link} href="/contact" variant="outlined" sx={{ borderColor: '#12a862', color: '#12a862' }}>
              ติดต่อทีมงาน
            </Button>
            <Button component={Link} href="/pricing" variant="text" color="inherit">
              ดูแผนราคา
            </Button>
          </Stack>
          <Typography variant="caption" color="text.secondary">
            Starter ฟรี • 50 คิว/เดือน • ตั้งค่าเริ่มต้นได้ใน 5 นาที
          </Typography>
        </Stack>
      </Paper>
    </Container>
  );
}

function SectionWrap({ id, title, sub, tag, bg, children }: { id?: string; title: string; sub: string; tag: string; bg: string; children: React.ReactNode }) {
  return (
    <Box id={id} sx={{ py: { xs: 6, md: 8 }, bgcolor: sectionBg(bg), scrollMarginTop: '96px' }}>
      <Container maxWidth="lg">
        <Stack alignItems="center" sx={{ mb: { xs: 3, md: 4 } }}>
          <Chip label={tag} sx={[brandChipSx, { mb: 1.5 }]} />
          <Typography
            variant="h4"
            fontWeight={800}
            textAlign="center"
            sx={{ width: '100%', fontSize: { xs: 24, sm: 30, md: 34 }, letterSpacing: '-0.01em', textWrap: 'balance' }}
          >
            {title}
          </Typography>
          <Typography color="text.secondary" textAlign="center" sx={{ mt: 1, width: '100%', maxWidth: 640, px: 1 }}>
            {sub}
          </Typography>
        </Stack>
        {children}
      </Container>
    </Box>
  );
}
