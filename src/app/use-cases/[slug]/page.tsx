import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { Box, Button, Card, CardContent, Container, Grid, Stack, Typography } from '@mui/material';
import { LandingNavbar } from '@/components/public/landing-navbar';
import { LandingFooter } from '@/components/public/landing-footer';
import { useCases } from '@/components/public/content';

type Params = { slug: string };

export function generateStaticParams() {
  return useCases.map((u) => ({ slug: u.slug }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const found = useCases.find((u) => u.slug === slug);
  if (!found) return {};
  return {
    title: `${found.title} | ระบบจองคิวผ่าน LINE OA`,
    description: `${found.title}: ${found.summary}`,
    alternates: {
      canonical: `/use-cases/${found.slug}`,
      languages: {
        'th-TH': `/use-cases/${found.slug}`,
        'en-US': `/en/use-cases/${found.slug}`,
        'x-default': `/use-cases/${found.slug}`,
      },
    },
  };
}

export default async function UseCaseDetailPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const item = useCases.find((u) => u.slug === slug);
  if (!item) notFound();
  const Icon = item.icon;
  const showcaseMap: Record<string, {
    customerTitle: string;
    customerDesc: string;
    customerImages: Array<{ src: string; title: string; width: number; height: number }>;
    storeDesc: string;
    storeImages: Array<{ src: string; title: string; width: number; height: number }>;
  }> = {
    'barber-shop': {
      customerTitle: 'มุมลูกค้า',
      customerDesc: 'ลูกค้าเลือกบริการ เลือกช่าง เลือกวันเวลาใน LIFF และรับ Flex ยืนยันการจองในแชท LINE ทันที',
      customerImages: [
        { src: '/images/use-cases/barber/liff-step-1.jpg', title: 'Step 1: เลือกบริการ + เลือกช่าง', width: 900, height: 1600 },
        { src: '/images/use-cases/barber/liff-step-2.jpg', title: 'Step 2: เลือกวันเวลา', width: 900, height: 1600 },
        { src: '/images/use-cases/barber/liff-time-slots.jpg', title: 'เลือกช่วงเวลาว่าง', width: 900, height: 1600 },
        { src: '/images/use-cases/barber/line-flex-success.png', title: 'Flex Message ยืนยันการจอง', width: 900, height: 1600 },
      ],
      storeDesc: 'หลังบ้านเห็นการแจ้งเตือนคิวใหม่, มุมมองปฏิทินรายเดือน, รายละเอียดคิวรายวัน และหน้าจอเรียกคิว (Digital Signage)',
      storeImages: [
        { src: '/images/use-cases/barber/notification-dropdown.jpg', title: 'Notification: แจ้งเตือนคิวใหม่', width: 1200, height: 900 },
        { src: '/images/use-cases/barber/calendar-view.jpg', title: 'Calendar: ภาพรวมคิวทั้งเดือน', width: 1200, height: 900 },
        { src: '/images/use-cases/barber/daily-queue-list.jpg', title: 'รายการคิวรายวัน + สถานะคิว', width: 1200, height: 900 },
        { src: '/images/use-cases/barber/signage-desktop.jpg', title: 'Digital Signage: เรียกคิวหน้าร้าน', width: 1200, height: 900 },
      ],
    },
    clinic: {
      customerTitle: 'มุมลูกค้า',
      customerDesc: 'ลูกค้าเลือกบริการ พบแพทย์/ห้องตรวจ เลือกวันเวลาใน LIFF และรับ Flex ยืนยันการนัดหมายผ่าน LINE ทันที',
      customerImages: [
        { src: '/images/use-cases/clinic/liff-step-1.jpg', title: 'Step 1: เลือกบริการ + เลือก Resource', width: 885, height: 1851 },
        { src: '/images/use-cases/clinic/liff-step-2.jpg', title: 'Step 2: เลือกวันเวลา', width: 883, height: 1853 },
        { src: '/images/use-cases/clinic/line-flex-success.jpg', title: 'Flex Message ยืนยันการจอง', width: 727, height: 1212 },
      ],
      storeDesc: 'มุมร้านเห็นแจ้งเตือนคิวใหม่ทันที พร้อม Calendar, รายการคิวรายวัน และหน้าจอ Signage สำหรับเรียกคิวคนไข้',
      storeImages: [
        { src: '/images/use-cases/clinic/notification-dropdown.jpg', title: 'Notification: แจ้งเตือนคิวใหม่', width: 439, height: 621 },
        { src: '/images/use-cases/clinic/calendar-view.jpg', title: 'Calendar: ภาพรวมคิวทั้งเดือน', width: 749, height: 901 },
        { src: '/images/use-cases/clinic/daily-queue-list.jpg', title: 'รายการคิวรายวัน + สถานะคิว', width: 730, height: 435 },
        { src: '/images/use-cases/clinic/signage-desktop.jpg', title: 'Digital Signage: เรียกคิวหน้าคลินิก', width: 1064, height: 1895 },
      ],
    },
    'meeting-room': {
      customerTitle: 'มุมลูกค้า',
      customerDesc: 'ลูกค้าเลือกบริการจองห้อง เลือกห้องประชุม เลือกวันเวลาใน LIFF และรับ Flex ยืนยันการจองผ่าน LINE ทันที',
      customerImages: [
        { src: '/images/use-cases/meeting-room/liff-step-1.jpg', title: 'Step 1: เลือกบริการ + เลือกห้องประชุม', width: 883, height: 1855 },
        { src: '/images/use-cases/meeting-room/liff-step-2.jpg', title: 'Step 2: เลือกวันเวลา', width: 884, height: 1851 },
        { src: '/images/use-cases/meeting-room/line-flex-success.jpg', title: 'Flex Message ยืนยันการจอง', width: 736, height: 1207 },
      ],
      storeDesc: 'หลังบ้านเห็นแจ้งเตือนคิวใหม่, มุมมองปฏิทินรายเดือน, รายการคิวรายวัน และหน้าจอ Signage สำหรับเรียกคิว/แสดงสถานะ',
      storeImages: [
        { src: '/images/use-cases/meeting-room/notification-dropdown.jpg', title: 'Notification: แจ้งเตือนคิวใหม่', width: 439, height: 621 },
        { src: '/images/use-cases/meeting-room/calendar-view.jpg', title: 'Calendar: ภาพรวมคิวทั้งเดือน', width: 749, height: 901 },
        { src: '/images/use-cases/meeting-room/daily-queue-list.jpg', title: 'รายการคิวรายวัน + สถานะคิว', width: 730, height: 435 },
        { src: '/images/use-cases/meeting-room/signage-desktop.jpg', title: 'Digital Signage: เรียกคิวหน้าร้าน', width: 1064, height: 1895 },
      ],
    },
    buffet: {
      customerTitle: 'มุมลูกค้า',
      customerDesc: 'ลูกค้าเลือกประเภทรอบบุฟเฟ่ต์หรือคิวหน้าร้าน เลือกโต๊ะ/จำนวนที่นั่ง เลือกวันเวลาใน LIFF และรับ Flex ยืนยันการจองผ่าน LINE',
      customerImages: [
        { src: '/images/use-cases/buffet/liff-step-1.jpg', title: 'Step 1: เลือกบริการ + เลือกโต๊ะ', width: 896, height: 1827 },
        { src: '/images/use-cases/buffet/liff-step-2.jpg', title: 'Step 2: เลือกวันเวลา', width: 884, height: 1851 },
        { src: '/images/use-cases/buffet/line-flex-success.jpg', title: 'Flex Message ยืนยันการจอง', width: 742, height: 1246 },
      ],
      storeDesc: 'หลังบ้านเห็นแจ้งเตือนคิวใหม่ทันที มีมุมมองปฏิทิน รายการคิวรายวัน และหน้าจอ Signage สำหรับเรียกคิวหน้าร้าน',
      storeImages: [
        { src: '/images/use-cases/buffet/notification-dropdown.jpg', title: 'Notification: แจ้งเตือนคิวใหม่', width: 439, height: 621 },
        { src: '/images/use-cases/buffet/calendar-view.jpg', title: 'Calendar: ภาพรวมคิวทั้งเดือน', width: 749, height: 901 },
        { src: '/images/use-cases/buffet/daily-queue-list.jpg', title: 'รายการคิวรายวัน + สถานะคิว', width: 730, height: 435 },
        { src: '/images/use-cases/buffet/signage-desktop.jpg', title: 'Digital Signage: เรียกคิวหน้าร้าน', width: 1064, height: 1895 },
      ],
    },
    restaurant: {
      customerTitle: 'มุมลูกค้า',
      customerDesc: 'ลูกค้าเลือกจองโต๊ะหรือคิว Walk-in เลือกโต๊ะตามจำนวนที่นั่ง เลือกวันเวลาใน LIFF และรับ Flex ยืนยันการจองผ่าน LINE ทันที',
      customerImages: [
        { src: '/images/use-cases/restaurant/liff-step-1.jpg', title: 'Step 1: เลือกบริการ + เลือกโต๊ะ', width: 884, height: 1852 },
        { src: '/images/use-cases/restaurant/liff-step-2.jpg', title: 'Step 2: เลือกวันเวลา', width: 884, height: 1852 },
        { src: '/images/use-cases/restaurant/line-flex-success.jpg', title: 'Flex Message ยืนยันการจอง', width: 738, height: 1239 },
      ],
      storeDesc: 'ฝั่งร้านเห็นแจ้งเตือนคิวใหม่ทันที พร้อมมุมมองปฏิทิน รายการคิวรายวัน และหน้าจอ Signage สำหรับเรียกคิวหน้าร้าน',
      storeImages: [
        { src: '/images/use-cases/restaurant/notification-dropdown.jpg', title: 'Notification: แจ้งเตือนคิวใหม่', width: 439, height: 621 },
        { src: '/images/use-cases/restaurant/calendar-view.jpg', title: 'Calendar: ภาพรวมคิวทั้งเดือน', width: 749, height: 901 },
        { src: '/images/use-cases/restaurant/daily-queue-list.jpg', title: 'รายการคิวรายวัน + สถานะคิว', width: 730, height: 435 },
        { src: '/images/use-cases/restaurant/signage-desktop.jpg', title: 'Digital Signage: เรียกคิวหน้าร้าน', width: 1064, height: 1895 },
      ],
    },
  };
  const showcase = showcaseMap[item.slug];

  return (
    <main>
      <LandingNavbar />
      <Container maxWidth="md" sx={{ py: 8 }}>
        <Stack direction="row" spacing={1.2} alignItems="center" sx={{ mb: 2 }}>
          <Box sx={{ width: 44, height: 44, borderRadius: 1, bgcolor: '#eaf3de', display: 'grid', placeItems: 'center' }}>
            <Icon sx={{ color: '#12a862' }} />
          </Box>
          <div>
            <Typography variant="h4" fontWeight={800}>{item.title}</Typography>
            <Typography color="text.secondary">{item.mode}</Typography>
          </div>
        </Stack>

        <Card sx={{ borderRadius: 1 }}>
          <CardContent>
            <Typography variant="body1" color="text.secondary">{item.summary}</Typography>
            <Typography fontWeight={700} sx={{ mt: 2 }}>ตัวอย่างบริการที่แนะนำ</Typography>
            <Stack spacing={0.8} sx={{ mt: 1 }}>
              {item.services.map((s) => (
                <Typography key={s}>• {s}</Typography>
              ))}
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.2} sx={{ mt: 3 }}>
              <Button component={Link} href="/register" variant="contained">เริ่มใช้งานฟรี</Button>
              <Button component={Link} href="/contact" variant="outlined">ปรึกษาทีมงาน</Button>
              <Button component={Link} href="/use-cases" variant="text">กลับหน้าตัวอย่างธุรกิจ</Button>
            </Stack>
          </CardContent>
        </Card>

        {showcase ? (
          <Stack spacing={2} sx={{ mt: 2.5 }}>
            <Card sx={{ borderRadius: 2, border: '1px solid #dce6df', boxShadow: 'none' }}>
              <CardContent>
                <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#6a7a6c', letterSpacing: 0.3 }}>ตัวอย่างหน้าจอ</Typography>
                <Typography variant="h6" fontWeight={800} sx={{ mt: 0.2 }}>{showcase.customerTitle}</Typography>
                <Typography color="text.secondary" sx={{ mt: 0.6 }}>
                  {showcase.customerDesc}
                </Typography>
                <Grid container spacing={1.2} sx={{ mt: 0.6 }}>
                  {showcase.customerImages.map((img) => (
                    <Grid key={img.src} size={{ xs: 12, sm: 6 }}>
                      <Box sx={{ border: '1px solid #dce6df', borderRadius: 2, overflow: 'hidden', bgcolor: '#f7faf8' }}>
                        <Box sx={{ p: 1 }}>
                          <Box sx={{ border: '1px solid #d8e6dc', borderRadius: 2, overflow: 'hidden', bgcolor: '#fff' }}>
                            <Image src={img.src} alt={img.title} width={img.width} height={img.height} style={{ width: '100%', height: 'auto', display: 'block' }} />
                          </Box>
                        </Box>
                        <Typography variant="caption" sx={{ display: 'block', px: 1.2, py: 0.9, color: 'text.secondary', borderTop: '1px solid #e7efe9' }}>{img.title}</Typography>
                      </Box>
                    </Grid>
                  ))}
                </Grid>
              </CardContent>
            </Card>

            <Card sx={{ borderRadius: 2, border: '1px solid #dce6df', boxShadow: 'none' }}>
              <CardContent>
                <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#6a7a6c', letterSpacing: 0.3 }}>ตัวอย่างหน้าจอ</Typography>
                <Typography variant="h6" fontWeight={800} sx={{ mt: 0.2 }}>มุมร้าน</Typography>
                <Typography color="text.secondary" sx={{ mt: 0.6 }}>
                  {showcase.storeDesc}
                </Typography>
                <Grid container spacing={1.2} sx={{ mt: 0.6 }}>
                  {showcase.storeImages.map((img) => (
                    <Grid key={img.src} size={{ xs: 12, sm: 6 }}>
                      <Box sx={{ border: '1px solid #dce6df', borderRadius: 2, overflow: 'hidden', bgcolor: '#f7faf8' }}>
                        <Box sx={{ p: 1 }}>
                          <Box sx={{ border: '1px solid #d8e6dc', borderRadius: 2, overflow: 'hidden', bgcolor: '#fff' }}>
                            <Image src={img.src} alt={img.title} width={img.width} height={img.height} style={{ width: '100%', height: 'auto', display: 'block' }} />
                          </Box>
                        </Box>
                        <Typography variant="caption" sx={{ display: 'block', px: 1.2, py: 0.9, color: 'text.secondary', borderTop: '1px solid #e7efe9' }}>{img.title}</Typography>
                      </Box>
                    </Grid>
                  ))}
                </Grid>
              </CardContent>
            </Card>
          </Stack>
        ) : null}
      </Container>
      <LandingFooter />
    </main>
  );
}
