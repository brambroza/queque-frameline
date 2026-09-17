import type { Metadata } from 'next';
import Link from 'next/link';
import { Box, Card, CardContent, Container, Grid, Stack, Typography } from '@mui/material';
import { LandingNavbar } from '@/components/public/landing-navbar';
import { LandingFooter } from '@/components/public/landing-footer';
import { useCases } from '@/components/public/content';
import { useCasesEnBySlug } from '@/components/public/use-cases-content-en';

export const metadata: Metadata = {
  title: 'Use Cases | ระบบจองคิวผ่าน LINE OA | QueueBooking LINE',
  description: 'Explore practical queue booking setups for barbers, clinics, restaurants, and service teams.',
  alternates: {
    canonical: '/en/use-cases',
    languages: {
      'th-TH': '/use-cases',
      'en-US': '/en/use-cases',
      'x-default': '/use-cases',
    },
  },
};

export default function UseCasesEnPage() {
  return (
    <main>
      <LandingNavbar />
      <Container maxWidth="xl" sx={{ py: 8 }}>
        <Typography variant="h3" fontWeight={800}>Use Cases by Industry</Typography>
        <Typography color="text.secondary" sx={{ mt: 1, mb: 3 }}>
          Pick queue logic and service formats that fit your business model.
        </Typography>

        <Grid container spacing={2}>
          {useCases.map((item) => {
            const Icon = item.icon;
            const en = useCasesEnBySlug[item.slug];
            return (
              <Grid key={item.slug} size={{ xs: 12, md: 6, lg: 4 }}>
                <Card sx={{ borderRadius: 3, height: '100%' }}>
                  <CardContent>
                    <Stack direction="row" spacing={1.2} alignItems="center">
                      <Box sx={{ width: 40, height: 40, borderRadius: 2, bgcolor: '#eaf3de', display: 'grid', placeItems: 'center' }}>
                        <Icon sx={{ color: '#12a862' }} />
                      </Box>
                      <Typography fontWeight={700}>{en?.title ?? item.title}</Typography>
                    </Stack>
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                      {en?.mode ?? item.mode}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1.2 }}>
                      {en?.summary ?? item.summary}
                    </Typography>
                    <Stack spacing={0.4} sx={{ mt: 1.2 }}>
                      {(en?.services ?? item.services).map((s) => (
                        <Typography key={s} variant="body2">• {s}</Typography>
                      ))}
                    </Stack>
                    <Box sx={{ mt: 1.8 }}>
                      <Link href={`/en/use-cases/${item.slug}`}>View details</Link>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      </Container>
      <LandingFooter />
    </main>
  );
}

