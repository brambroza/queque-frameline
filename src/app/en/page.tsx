import type { Metadata } from 'next';
import Link from 'next/link';
import { Box, Button, Container, Grid, Paper, Stack, Typography } from '@mui/material';
import { LandingNavbar } from '@/components/public/landing-navbar';
import { LandingFooter } from '@/components/public/landing-footer';

export const metadata: Metadata = {
  title: 'LINE OA Queue Booking Platform for Service Businesses',
  description: 'Queue booking platform with LINE OA, LIFF, and back-office dashboard for branches, services, staff, and reports.',
  alternates: {
    canonical: '/en',
    languages: {
      'th-TH': '/',
      'en-US': '/en',
      'x-default': '/',
    },
  },
  openGraph: {
    title: 'LINE OA Queue Booking Platform for Service Businesses',
    description: 'Queue booking platform with LINE OA, LIFF, and a professional dashboard.',
    url: '/en',
    type: 'website',
    locale: 'en_US',
  },
};

export default function HomeEnPage() {
  return (
    <main>
      <LandingNavbar />
      <Box sx={{ background: '#fff', py: { xs: 8, md: 10 }, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Container maxWidth="lg">
          <Grid container spacing={4} alignItems="center">
            <Grid size={{ xs: 12, md: 7 }}>
              <Typography sx={{ fontSize: { xs: 32, md: 46 }, lineHeight: 1.2, fontWeight: 700 }}>
                LINE OA Queue Booking Platform
              </Typography>
              <Typography color="text.secondary" sx={{ mt: 2, maxWidth: 620 }}>
                Let customers check available slots and book via LINE. Manage branches, services, queue flow, staff, and reports in one dashboard.
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.2} sx={{ mt: 3 }}>
                <Button component={Link} href="/register" variant="contained">Start Free</Button>
                <Button component={Link} href="/en/pricing" variant="outlined">View Pricing</Button>
                <Button component={Link} href="/en/contact" variant="outlined" color="inherit">Contact Sales</Button>
              </Stack>
            </Grid>
            <Grid size={{ xs: 12, md: 5 }}>
              <Paper sx={{ p: 2.5, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
                <Typography fontWeight={700}>Trusted by service businesses</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Built for barbers, clinics, restaurants, service centers, and installation teams.
                </Typography>
              </Paper>
            </Grid>
          </Grid>
        </Container>
      </Box>
      <LandingFooter />
    </main>
  );
}
