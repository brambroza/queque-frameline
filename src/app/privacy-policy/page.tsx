import type { Metadata } from 'next';
import { Box, Container, Divider, Paper, Stack, Typography } from '@mui/material';
import { LandingFooter } from '@/components/public/landing-footer';
import { LandingNavbar } from '@/components/public/landing-navbar';
import { ManageConsentButton } from '@/components/consent/manage-consent-button';

export const metadata: Metadata = {
  title: 'นโยบายความเป็นส่วนตัวและคุกกี้ | QueueBooking LINE',
  description:
    'นโยบายความเป็นส่วนตัวและการใช้คุกกี้ของ QueueBooking LINE ตาม พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล (PDPA)',
  alternates: { canonical: '/privacy-policy' },
  robots: { index: true, follow: true },
};

const cookieTypes = [
  {
    title: 'คุกกี้ที่จำเป็น (Necessary)',
    desc: 'จำเป็นต่อการทำงานพื้นฐานของเว็บไซต์ เช่น การเข้าสู่ระบบ ความปลอดภัย และการจดจำการตั้งค่า ไม่สามารถปิดได้',
  },
  {
    title: 'คุกกี้เพื่อการวิเคราะห์ (Analytics)',
    desc: 'ช่วยให้เราเข้าใจพฤติกรรมการใช้งานเว็บไซต์แบบไม่ระบุตัวตน เพื่อปรับปรุงประสบการณ์การใช้งาน จะทำงานเมื่อคุณให้ความยินยอมเท่านั้น',
  },
  {
    title: 'คุกกี้เพื่อการตลาด (Marketing)',
    desc: 'ใช้เพื่อนำเสนอเนื้อหาและโฆษณาให้ตรงกับความสนใจของคุณ จะทำงานเมื่อคุณให้ความยินยอมเท่านั้น',
  },
];

const rights = [
  'สิทธิในการเข้าถึงและขอสำเนาข้อมูลส่วนบุคคล',
  'สิทธิในการขอแก้ไขข้อมูลให้ถูกต้องเป็นปัจจุบัน',
  'สิทธิในการขอลบหรือทำลายข้อมูล',
  'สิทธิในการเพิกถอนความยินยอมเมื่อใดก็ได้',
  'สิทธิในการคัดค้านหรือระงับการใช้ข้อมูล',
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Stack spacing={1.2}>
      <Typography variant="h6" fontWeight={800}>
        {title}
      </Typography>
      {children}
    </Stack>
  );
}

export default function PrivacyPolicyPage() {
  return (
    <>
      <LandingNavbar />
      <Box sx={{ bgcolor: 'background.default', py: { xs: 5, md: 8 } }}>
        <Container maxWidth="md">
          <Stack spacing={1} sx={{ mb: 4 }}>
            <Typography variant="h3" fontWeight={800} sx={{ fontSize: { xs: 28, md: 40 } }}>
              นโยบายความเป็นส่วนตัวและคุกกี้
            </Typography>
            <Typography color="text.secondary">
              QueueBooking LINE ให้ความสำคัญกับการคุ้มครองข้อมูลส่วนบุคคลของคุณ ตาม พ.ร.บ.
              คุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 (PDPA)
            </Typography>
          </Stack>

          <Paper
            variant="outlined"
            sx={{ p: { xs: 2.5, md: 4 }, borderRadius: 3, borderColor: 'divider' }}
          >
            <Stack spacing={3.5} divider={<Divider flexItem />}>
              <Section title="1. คุกกี้คืออะไร">
                <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.9 }}>
                  คุกกี้คือไฟล์ข้อความขนาดเล็กที่ถูกจัดเก็บไว้บนอุปกรณ์ของคุณเมื่อเข้าชมเว็บไซต์
                  เพื่อช่วยให้เว็บไซต์ทำงานได้อย่างถูกต้องและจดจำการตั้งค่าของคุณ
                </Typography>
              </Section>

              <Section title="2. ประเภทของคุกกี้ที่เราใช้">
                <Stack spacing={1.8}>
                  {cookieTypes.map((c) => (
                    <Box key={c.title}>
                      <Typography fontWeight={700} sx={{ fontSize: 15 }}>
                        {c.title}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.3, lineHeight: 1.8 }}>
                        {c.desc}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              </Section>

              <Section title="3. สิทธิของเจ้าของข้อมูลส่วนบุคคล">
                <Stack spacing={0.8}>
                  {rights.map((r) => (
                    <Typography key={r} variant="body2" color="text.secondary" sx={{ lineHeight: 1.8 }}>
                      • {r}
                    </Typography>
                  ))}
                </Stack>
              </Section>

              <Section title="4. การจัดการความยินยอม">
                <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.9 }}>
                  คุณสามารถเปลี่ยนแปลงหรือเพิกถอนความยินยอมการใช้คุกกี้ได้ตลอดเวลา
                  โดยกดปุ่มด้านล่างเพื่อเปิดการตั้งค่าคุกกี้อีกครั้ง
                </Typography>
                <Box sx={{ mt: 1 }}>
                  <ManageConsentButton />
                </Box>
              </Section>

              <Section title="5. ติดต่อเรา">
                <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.9 }}>
                  หากมีคำถามเกี่ยวกับนโยบายความเป็นส่วนตัวหรือต้องการใช้สิทธิของคุณ ติดต่อได้ที่
                  <br />
                  อีเมล: amnart.gl@gmail.com · โทร: 085-608-3298 · LINE OA: @queuebooking
                </Typography>
              </Section>
            </Stack>
          </Paper>

          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 3 }}>
            ปรับปรุงล่าสุด: กรกฎาคม 2569
          </Typography>
        </Container>
      </Box>
      <LandingFooter />
    </>
  );
}
