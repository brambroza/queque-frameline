import type { Metadata } from 'next';
import Link from 'next/link';
import { Box, Button, Chip, Container, Grid, Paper, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import { LandingFooter } from '@/components/public/landing-footer';
import { LandingNavbar } from '@/components/public/landing-navbar';
import { faqs, featureCompare, pricingPlans } from '@/components/public/content';
import { FaqSection } from '@/components/public/faq-section';
import { PricingCard } from '@/components/public/pricing-card';

export const metadata: Metadata = {
  title: 'แผนราคา | ระบบจองคิวผ่าน LINE OA | ลูกค้าจองคิวเอง | ระบบจองคิว',
  description:
    'เลือกแผนการใช้งานระบบจองคิวผ่าน LINE OA สำหรับร้านค้า คลินิก ร้านอาหาร ศูนย์บริการ | ระบบจองคิวผ่าน LINE OA | QueueBooking LINE',
  alternates: {
    canonical: '/pricing',
    languages: {
      'th-TH': '/pricing',
      'en-US': '/en/pricing',
      'x-default': '/pricing',
    },
  },
  openGraph: {
    title: 'แผนราคา | ระบบจองคิวผ่าน LINE OA | ลูกค้าจองคิวเอง | ระบบจองคิว',
    description: 'เลือกแผนการใช้งานระบบจองคิวผ่าน LINE OA ให้เหมาะกับธุรกิจของคุณ',
    url: '/pricing',
    type: 'website',
    locale: 'th_TH',
  },
};

const BRAND = '#12a862';

export default function PricingPage() {
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: {
        '@type': 'Answer',
        text: f.a,
      },
    })),
  };

  return (
    <main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <LandingNavbar />
      <Container maxWidth="lg" sx={{ py: { xs: 6, md: 10 } }}>
        <Stack spacing={1.5} alignItems="center" textAlign="center" sx={{ mb: { xs: 5, md: 7 } }}>
          <Chip
            label="Starter ฟรี 50 คิวต่อเดือน"
            sx={{ fontWeight: 600, color: BRAND, bgcolor: 'rgba(18,168,98,.1)' }}
          />
          <Typography variant="h3" fontWeight={800} sx={{ letterSpacing: '-.02em' }}>
            เลือกแพ็กเกจที่พอดีกับขนาดธุรกิจของคุณ
          </Typography>
          <Typography color="text.secondary" sx={{ maxWidth: 520 }}>
            ปรับเปลี่ยนหรือยกเลิกได้ทุกเมื่อ ไม่มีสัญญาผูกมัด
          </Typography>
        </Stack>

        <Grid container spacing={2.5}>
          {pricingPlans.map((p) => (
            <Grid key={p.code} size={{ xs: 12, sm: 6, md: 3 }}>
              <PricingCard
                name={p.name}
                price={p.price}
                period={p.period}
                items={p.items}
                highlight={p.highlight}
                ctaHref={p.contactSales ? '/contact' : `/register?plan=${p.code}`}
                ctaLabel={p.contactSales ? 'ติดต่อฝ่ายขาย' : p.code === 'starter' ? 'เริ่มใช้ฟรี' : 'เริ่มใช้ฟรี แล้วอัปเกรด'}
              />
            </Grid>
          ))}
        </Grid>

        <Stack spacing={0.75} sx={{ mt: 3 }}>
          <Typography variant="caption" color="text.secondary">
            * ราคายังไม่รวมภาษีมูลค่าเพิ่ม (VAT 7%)
          </Typography>
          <Typography variant="caption" color="text.secondary">
            * ราคาข้างต้นเป็นค่าบริการระบบจองคิวเท่านั้น <Box component="strong" sx={{ color: 'text.primary' }}>ไม่รวมค่าบริการ LINE Messaging API</Box> ซึ่งคิดตามปริมาณข้อความที่ส่งจริงตามอัตราของ LINE OA โดยตรง (ร้านค้าเป็นผู้ชำระกับ LINE)
          </Typography>
        </Stack>

        <Box sx={{ mt: { xs: 7, md: 10 }, textAlign: 'center', mb: 4 }}>
          <Typography variant="h4" fontWeight={800} sx={{ letterSpacing: '-.02em' }}>
            เปรียบเทียบทุกแพ็กเกจ
          </Typography>
        </Box>

        <Paper elevation={0} sx={{ borderRadius: 1, overflow: 'hidden', border: '1px solid', borderColor: 'divider' }}>
          <Box sx={{ overflowX: 'auto' }}>
            <Table sx={{ minWidth: 720, '& td, & th': { borderColor: 'divider' } }}>
              <TableHead>
                <TableRow sx={{ '& th': { fontWeight: 700, bgcolor: 'rgba(18,168,98,.05)', whiteSpace: 'nowrap' } }}>
                  <TableCell>Feature</TableCell>
                  <TableCell align="center">Starter</TableCell>
                  <TableCell align="center" sx={{ color: BRAND }}>Professional</TableCell>
                  <TableCell align="center">Business</TableCell>
                  <TableCell align="center">Enterprise</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {featureCompare.map((r) => (
                  <TableRow key={r.key} sx={{ '&:last-child td': { border: 0 }, '&:hover': { bgcolor: 'action.hover' } }}>
                    <TableCell sx={{ fontWeight: 600 }}>{r.key}</TableCell>
                    <TableCell align="center">{r.starter}</TableCell>
                    <TableCell align="center" sx={{ bgcolor: 'rgba(18,168,98,.04)' }}>{r.pro}</TableCell>
                    <TableCell align="center">{r.business}</TableCell>
                    <TableCell align="center">{r.enterprise}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        </Paper>
      </Container>

      <FaqSection items={faqs} />

      <Container maxWidth="lg" sx={{ pb: { xs: 8, md: 12 } }}>
        <Box
          sx={{
            p: { xs: 4, md: 6 },
            borderRadius: 1.5,
            textAlign: 'center',
            color: '#fff',
            background: `linear-gradient(135deg, ${BRAND} 0%, #0d8a4f 100%)`,
          }}
        >
          <Typography variant="h4" fontWeight={800} sx={{ letterSpacing: '-.02em' }}>
            ต้องการแพ็กเกจเฉพาะองค์กร?
          </Typography>
          <Typography sx={{ mt: 1, opacity: 0.9, maxWidth: 560, mx: 'auto' }}>
            คุยกับทีมฝ่ายขายเพื่อออกแบบโซลูชันที่เหมาะกับธุรกิจของคุณ พร้อม SLA และการดูแลแบบ Dedicated
          </Typography>
          <Button
            component={Link}
            href="/contact"
            variant="contained"
            endIcon={<ArrowForwardRoundedIcon />}
            sx={{
              mt: 3,
              px: 4,
              py: 1.25,
              borderRadius: 1,
              fontWeight: 700,
              color: BRAND,
              bgcolor: '#fff',
              '&:hover': { bgcolor: 'rgba(255,255,255,.9)' },
            }}
          >
            ติดต่อฝ่ายขาย
          </Button>
        </Box>
      </Container>
      <LandingFooter />
    </main>
  );
}
