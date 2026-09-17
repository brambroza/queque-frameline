import type { Metadata } from 'next';
import { Container, Grid, Paper, Stack, Typography } from '@mui/material';
import { LandingNavbar } from '@/components/public/landing-navbar';
import { LandingFooter } from '@/components/public/landing-footer';
import { ContactForm } from '@/components/public/contact-form';

export const metadata: Metadata = {
  title: 'Contact | ระบบจองคิวผ่าน LINE OA | QueueBooking LINE',
  description: 'Talk to our team for demo, onboarding, and pricing consultation.',
  alternates: {
    canonical: '/en/contact',
    languages: {
      'th-TH': '/contact',
      'en-US': '/en/contact',
      'x-default': '/contact',
    },
  },
};

export default function ContactEnPage() {
  return (
    <main>
      <LandingNavbar />
      <Container maxWidth="xl" sx={{ py: 8 }}>
        <Typography variant="h3" fontWeight={800}>Contact Us</Typography>
        <Typography color="text.secondary" sx={{ mt: 1, mb: 3 }}>Our team is ready to help you launch your LINE OA queue booking flow.</Typography>
        <Grid container spacing={2.5}>
          <Grid size={{ xs: 12, md: 7 }}>
            <Paper sx={{ p: 3, borderRadius: 3 }}><ContactForm /></Paper>
          </Grid>
          <Grid size={{ xs: 12, md: 5 }}>
            <Paper sx={{ p: 3, borderRadius: 3 }}>
              <Stack spacing={1.2}>
                <Typography variant="h6" fontWeight={700}>Company Info</Typography>
                <Typography variant="body2">Phone: 085-608-3298</Typography>
                <Typography variant="body2">Email: amnart.gl@gmail.com</Typography>
                <Typography variant="body2">LINE OA: @queuebooking</Typography>
                <Typography variant="body2">Address: Bangkok, Thailand</Typography>
              </Stack>
            </Paper>
          </Grid>
        </Grid>
      </Container>
      <LandingFooter />
    </main>
  );
}

