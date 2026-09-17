import type { Metadata } from 'next';
import { Container } from '@mui/material';
import { LandingNavbar } from '@/components/public/landing-navbar';
import { LandingFooter } from '@/components/public/landing-footer';
import { DemoHero } from '@/components/demo/demo-hero';
import { DemoLineExperiencePanel } from '@/components/demo/demo-line-experience-panel';

export const metadata: Metadata = {
  title: 'โหมดทดลองระบบจองคิวผ่าน LINE | QueueBooking LINE',
  description: 'ทดลองประสบการณ์ลูกค้าและหลังบ้านของระบบจองคิวผ่าน LINE ได้ทันที โดยไม่ต้องล็อกอิน พร้อม Step Guide แบบเข้าใจง่าย',
  alternates: {
    canonical: '/sandbox-demo',
  },
};

export default function SandboxDemoPage() {
  return (
    <main>
      <LandingNavbar />
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <DemoHero />
        <div id="sandbox-panel" style={{ scrollMarginTop: 88 }}>
          <DemoLineExperiencePanel />
        </div>
      </Container>
      <LandingFooter />
    </main>
  );
}
