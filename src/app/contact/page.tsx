import type { Metadata } from 'next';
import { Box, Container, Grid, Link as MuiLink, Paper, Stack, Typography } from '@mui/material';
import PhoneRoundedIcon from '@mui/icons-material/PhoneRounded';
import EmailRoundedIcon from '@mui/icons-material/EmailRounded';
import ChatRoundedIcon from '@mui/icons-material/ChatRounded';
import LocationOnRoundedIcon from '@mui/icons-material/LocationOnRounded';
import ApartmentRoundedIcon from '@mui/icons-material/ApartmentRounded';
import { LandingFooter } from '@/components/public/landing-footer';
import { LandingNavbar } from '@/components/public/landing-navbar';
import { ContactForm } from '@/components/public/contact-form';
import { FaqSection } from '@/components/public/faq-section';
import { faqs } from '@/components/public/content';

const COMPANY = {
  name: 'GO Along Co., Ltd.',
  phone: '085-608-3298',
  phoneHref: 'tel:0856083298',
  email: 'amnart.gl@gmail.com',
  emailCompany: 'info@goalong.co.th',
  lineOA: '@queuebooking',
  lineHref: 'https://line.me/R/ti/p/@queuebooking',
  address: '918/288 หมู่ 10 ต.ในคลองบางปลากด อ.พระสมุทรเจดีย์ จ.สมุทรปราการ 10290',
  lat: 13.5934473,
  lng: 100.5124576,
};

/** แถวข้อมูลติดต่อ 1 บรรทัด — ไอคอนในวงกลมสีนุ่ม + label + value (กดได้ถ้ามี href) */
function InfoRow({
  icon,
  label,
  value,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  href?: string;
}) {
  const valueEl = href ? (
    <MuiLink
      href={href}
      target={href.startsWith('http') ? '_blank' : undefined}
      rel={href.startsWith('http') ? 'noopener noreferrer' : undefined}
      underline="hover"
      sx={{ fontWeight: 600, color: 'text.primary', '&:hover': { color: 'primary.main' } }}
    >
      {value}
    </MuiLink>
  ) : (
    <Typography sx={{ fontWeight: 600 }}>{value}</Typography>
  );

  return (
    <Stack direction="row" spacing={1.5} alignItems="flex-start">
      <Box
        sx={{
          flexShrink: 0,
          width: 40,
          height: 40,
          borderRadius: 2,
          display: 'grid',
          placeItems: 'center',
          bgcolor: 'rgba(18,168,98,0.12)',
          color: 'primary.main',
        }}
      >
        {icon}
      </Box>
      <Box sx={{ minWidth: 0, pt: 0.2 }}>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.2 }}>
          {label}
        </Typography>
        {valueEl}
      </Box>
    </Stack>
  );
}

export const metadata: Metadata = {
  title: 'ติดต่อเรา | ระบบจองคิวผ่าน LINE OA | QueueBooking LINE',
  description:
    'ติดต่อทีมงานเพื่อเริ่มใช้งานระบบจองคิวผ่าน LINE OA สำหรับธุรกิจของคุณ | Contact us for demo and onboarding.',
  alternates: {
    canonical: '/contact',
    languages: {
      'th-TH': '/contact',
      'en-US': '/en/contact',
      'x-default': '/contact',
    },
  },
  openGraph: {
    title: 'ติดต่อเรา | ระบบจองคิวผ่าน LINE OA | QueueBooking LINE',
    description: 'ติดต่อทีมงานเพื่อรับเดโมและเริ่มใช้งานระบบจองคิวผ่าน LINE OA',
    url: '/contact',
    type: 'website',
    locale: 'th_TH',
  },
};

export default function ContactPage() {
  const contactFaqs = faqs.slice(0, 3);
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: contactFaqs.map((f) => ({
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
      <Container maxWidth="xl" sx={{ py: 8 }}>
        <Typography variant="h3" fontWeight={800}>ติดต่อเรา</Typography>
        <Typography color="text.secondary" sx={{ mt: 1, mb: 3 }}>หากต้องการเดโมหรือคำแนะนำการเริ่มใช้งาน ทีมงานพร้อมช่วยทันที</Typography>

        <Grid container spacing={2.5}>
          <Grid size={{ xs: 12, md: 7 }}>
            <Paper sx={{ p: 3, borderRadius: 3 }}><ContactForm /></Paper>
          </Grid>
          <Grid size={{ xs: 12, md: 5 }}>
            <Paper
              variant="outlined"
              sx={{ borderRadius: 3, overflow: 'hidden', borderColor: 'divider', height: '100%' }}
            >
              {/* header ไล่เฉดสีแบรนด์ */}
              <Box
                sx={{
                  p: 3,
                  color: '#fff',
                  background: 'linear-gradient(135deg, #0a7043, #12a862)',
                }}
              >
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <Box
                    sx={{
                      width: 46,
                      height: 46,
                      borderRadius: 2.5,
                      display: 'grid',
                      placeItems: 'center',
                      bgcolor: 'rgba(255,255,255,0.18)',
                    }}
                  >
                    <ApartmentRoundedIcon />
                  </Box>
                  <Box>
                    <Typography variant="caption" sx={{ opacity: 0.85, lineHeight: 1 }}>
                      ข้อมูลติดต่อ
                    </Typography>
                    <Typography variant="h6" fontWeight={800} sx={{ lineHeight: 1.2 }}>
                      {COMPANY.name}
                    </Typography>
                  </Box>
                </Stack>
              </Box>

              {/* รายละเอียดติดต่อ */}
              <Stack spacing={2.25} sx={{ p: 3 }}>
                <InfoRow icon={<PhoneRoundedIcon fontSize="small" />} label="โทรศัพท์" value={COMPANY.phone} href={COMPANY.phoneHref} />
                <InfoRow icon={<EmailRoundedIcon fontSize="small" />} label="อีเมลบริษัท" value={COMPANY.emailCompany} href={`mailto:${COMPANY.emailCompany}`} />
                <InfoRow icon={<EmailRoundedIcon fontSize="small" />} label="อีเมล" value={COMPANY.email} href={`mailto:${COMPANY.email}`} />
                <InfoRow icon={<ChatRoundedIcon fontSize="small" />} label="LINE Official" value={COMPANY.lineOA} href={COMPANY.lineHref} />
                <InfoRow icon={<LocationOnRoundedIcon fontSize="small" />} label="ที่อยู่" value={COMPANY.address} />
              </Stack>

              {/* แผนที่ Google Map */}
              <Box
                component="iframe"
                title={`แผนที่ ${COMPANY.name}`}
                src={`https://maps.google.com/maps?q=${COMPANY.lat},${COMPANY.lng}&z=16&hl=th&output=embed`}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                sx={{
                  width: '100%',
                  height: 220,
                  border: 0,
                  borderTop: '1px solid',
                  borderColor: 'divider',
                  display: 'block',
                }}
              />
            </Paper>
          </Grid>
        </Grid>
      </Container>
      <FaqSection items={contactFaqs} />
      <LandingFooter />
    </main>
  );
}
