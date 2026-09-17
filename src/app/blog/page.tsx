import type { Metadata } from 'next';
import Link from 'next/link';
import { Card, CardContent, Chip, Container, Grid, Stack, Typography } from '@mui/material';
import { LandingNavbar } from '@/components/public/landing-navbar';
import { LandingFooter } from '@/components/public/landing-footer';
import { blogPosts } from '@/components/public/blog-content';
import { formatDateDMY } from '@/lib/utils/date-format';

export const metadata: Metadata = {
  title: 'บทความ | ระบบจองคิวผ่าน LINE OA | QueueBooking LINE',
  description: 'บทความเกี่ยวกับระบบจองคิวผ่าน LINE OA, LIFF, การลด no-show และแนวทางเพิ่มประสิทธิภาพงานบริการ',
  alternates: {
    canonical: '/blog',
    languages: {
      'th-TH': '/blog',
      'en-US': '/en/blog',
      'x-default': '/blog',
    },
  },
};

export default function BlogPage() {
  const faqItems = [
    {
      q: 'บทความนี้เหมาะกับธุรกิจแบบไหน?',
      a: 'เหมาะกับธุรกิจบริการที่ต้องการใช้ระบบจองคิวผ่าน LINE OA เช่น ร้านอาหาร คลินิก และศูนย์บริการต่าง ๆ.',
    },
    {
      q: 'ระบบจองคิวผ่าน LINE OA ช่วยลดงานหน้าร้านได้อย่างไร?',
      a: 'ช่วยลดการตอบแชทซ้ำ การรับโทรศัพท์ และความผิดพลาดจากการจดคิวมือ ด้วยระบบจองและแจ้งเตือนอัตโนมัติ.',
    },
    {
      q: 'ร้านอาหารสามารถใช้บทความนี้เพื่อเริ่มระบบจองโต๊ะได้หรือไม่?',
      a: 'ได้ บทความมีแนวทางการตั้งค่าและตัวอย่างใช้งานจริงสำหรับร้านอาหารที่ต้องการรับจองผ่าน LINE.',
    },
    {
      q: 'ระบบรองรับการลด no-show หรือไม่?',
      a: 'รองรับ โดยใช้การแจ้งเตือนก่อนเวลานัดและการยืนยันการจองผ่าน LINE OA.',
    },
    {
      q: 'สามารถนำแนวทางในบทความไปใช้กับหลายสาขาได้หรือไม่?',
      a: 'ได้ ระบบรองรับหลายสาขาและสามารถจัดการคิว/การจองแยกตามสาขาได้.',
    },
  ];

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

  return (
    <main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <LandingNavbar />
      <Container maxWidth="lg" sx={{ py: 8 }}>
        <Typography variant="h3" fontWeight={800}>บทความและแนวทางใช้งานระบบจองคิว</Typography>
        <Typography color="text.secondary" sx={{ mt: 1, mb: 3 }}>
          รวมวิธีใช้งานจริงและ best practices สำหรับธุรกิจบริการที่ใช้ LINE OA
        </Typography>

        <Grid container spacing={2}>
          {blogPosts.map((post) => (
            <Grid key={post.slug} size={{ xs: 12, md: 6 }}>
              <Card sx={{ borderRadius: 1, height: '100%' }}>
                <CardContent>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                    <Chip label={post.category} size="small" />

                    <Typography variant="caption" color="text.secondary">



                      {formatDateDMY(post.publishedAt)} • {post.readingMinutes} นาที
                    </Typography>
                  </Stack>
                  <Link href={`/blog/${post.slug}`}>
                   <Typography variant="h6" fontWeight={700}>{post.title}</Typography>
                  </Link>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>{post.description}</Typography>
                  <Stack direction="row" spacing={1} sx={{ mt: 1.4, flexWrap: 'wrap' }}>
                    {post.keywords.slice(0, 3).map((k) => <Chip key={k} label={k} size="small" variant="outlined" />)}
                  </Stack>
                  <Typography sx={{ mt: 1.8 }}>
                    <Link href={`/blog/${post.slug}`}>อ่านบทความ</Link>
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Container>
      <LandingFooter />
    </main>
  );
}
