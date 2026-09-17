import type { Metadata } from 'next';
import { Box, Container, Divider, Link, Paper, Stack, Typography } from '@mui/material';
import { LandingFooter } from '@/components/public/landing-footer';
import { LandingNavbar } from '@/components/public/landing-navbar';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description:
    'Terms governing the use of QueueBooking, an online booking and queue management platform operated by Go Along Co., Ltd.',
  alternates: { canonical: '/terms' },
  robots: { index: true, follow: true },
};

const platformFeatures = [
  'Online Bookings',
  'Appointments',
  'Queue Management',
  'Customer Notifications',
  'LINE Official Account Integration',
  'Business Scheduling',
];

const accountResponsibilities = [
  'Maintaining the confidentiality of your account',
  'Protecting your password',
  'Activities performed under your account',
];

const unacceptableUses = [
  'Violate any laws',
  'Attempt unauthorized access',
  'Distribute malware',
  'Abuse or disrupt the Service',
  'Use the Service for fraudulent purposes',
];

const thirdPartyServices = [
  'Google',
  'LINE',
  'Microsoft',
  'Zoom',
  'Stripe',
  'Omise',
  'Other third-party providers',
];

function TermsList({ items }: { items: string[] }) {
  return (
    <Box component="ul" sx={{ m: 0, pl: 3 }}>
      {items.map((item) => (
        <Typography
          component="li"
          key={item}
          color="text.secondary"
          sx={{ lineHeight: 1.85, pl: 0.5 }}
        >
          {item}
        </Typography>
      ))}
    </Box>
  );
}

function TermsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Stack component="section" spacing={1.5}>
      <Typography component="h2" variant="h5" fontWeight={800}>
        {title}
      </Typography>
      {children}
    </Stack>
  );
}

const bodyTextSx = { lineHeight: 1.85 } as const;

export default function TermsPage() {
  return (
    <>
      <LandingNavbar />
      <Box component="main" sx={{ bgcolor: 'background.default', py: { xs: 5, md: 8 } }}>
        <Container maxWidth="md">
          <Stack spacing={1.25} sx={{ mb: 4 }}>
            <Typography
              component="h1"
              variant="h3"
              fontWeight={800}
              sx={{ fontSize: { xs: 32, md: 44 } }}
            >
              Terms of Service
            </Typography>
            <Typography color="text.secondary">
              <strong>Effective Date:</strong> 5 August 2026
            </Typography>
          </Stack>

          <Paper
            variant="outlined"
            sx={{ p: { xs: 2.5, sm: 3.5, md: 5 }, borderRadius: 3, borderColor: 'divider' }}
          >
            <Stack spacing={4} divider={<Divider flexItem />}>
              <Stack spacing={2}>
                <Typography color="text.secondary" sx={bodyTextSx}>
                  These Terms of Service govern your use of QueueBooking, an online booking and
                  queue management platform owned and operated by{' '}
                  <strong>Go Along Co., Ltd.</strong>
                </Typography>
                <Typography color="text.secondary" sx={bodyTextSx}>
                  By accessing or using QueueBooking, you agree to these Terms.
                </Typography>
              </Stack>

              <TermsSection title="About QueueBooking">
                <Typography color="text.secondary" sx={bodyTextSx}>
                  QueueBooking is a Software-as-a-Service (SaaS) platform that enables businesses to
                  manage:
                </Typography>
                <TermsList items={platformFeatures} />
              </TermsSection>

              <TermsSection title="Eligibility">
                <Typography color="text.secondary" sx={bodyTextSx}>
                  You must use the Service in compliance with all applicable laws and regulations.
                </Typography>
              </TermsSection>

              <TermsSection title="User Accounts">
                <Typography color="text.secondary" sx={bodyTextSx}>
                  You are responsible for:
                </Typography>
                <TermsList items={accountResponsibilities} />
              </TermsSection>

              <TermsSection title="Acceptable Use">
                <Typography color="text.secondary" sx={bodyTextSx}>
                  You agree not to:
                </Typography>
                <TermsList items={unacceptableUses} />
              </TermsSection>

              <TermsSection title="Third-Party Services">
                <Typography color="text.secondary" sx={bodyTextSx}>
                  QueueBooking may integrate with:
                </Typography>
                <TermsList items={thirdPartyServices} />
                <Typography color="text.secondary" sx={bodyTextSx}>
                  Your use of these services is also subject to their respective terms.
                </Typography>
              </TermsSection>

              <TermsSection title="Google Services">
                <Typography color="text.secondary" sx={bodyTextSx}>
                  If you authorize QueueBooking to access your Google Account, we will only access
                  the information necessary to provide the requested features.
                </Typography>
                <Typography color="text.secondary" sx={bodyTextSx}>
                  You may revoke access at any time through your Google Account settings.
                </Typography>
              </TermsSection>

              <TermsSection title="Intellectual Property">
                <Typography color="text.secondary" sx={bodyTextSx}>
                  QueueBooking, including its software, website, source code, trademarks, logos,
                  user interface, documentation, graphics, and related content, is the intellectual
                  property of <strong>Go Along Co., Ltd.</strong>
                </Typography>
                <Typography color="text.secondary" sx={bodyTextSx}>
                  All rights are reserved.
                </Typography>
                <Typography color="text.secondary" sx={bodyTextSx}>
                  No part of the Service may be copied, modified, distributed, reverse engineered,
                  or reproduced without prior written permission from Go Along Co., Ltd.
                </Typography>
              </TermsSection>

              <TermsSection title="Availability">
                <Typography color="text.secondary" sx={bodyTextSx}>
                  We strive to provide reliable services but do not guarantee uninterrupted
                  availability.
                </Typography>
                <Typography color="text.secondary" sx={bodyTextSx}>
                  Maintenance, upgrades, or unforeseen circumstances may temporarily affect service
                  availability.
                </Typography>
              </TermsSection>

              <TermsSection title="Limitation of Liability">
                <Typography color="text.secondary" sx={bodyTextSx}>
                  To the maximum extent permitted by law, Go Along Co., Ltd. shall not be liable for
                  indirect, incidental, special, or consequential damages arising from the use of
                  the Service.
                </Typography>
              </TermsSection>

              <TermsSection title="Termination">
                <Typography color="text.secondary" sx={bodyTextSx}>
                  We reserve the right to suspend or terminate accounts that violate these Terms.
                </Typography>
              </TermsSection>

              <TermsSection title="Changes">
                <Typography color="text.secondary" sx={bodyTextSx}>
                  We may modify these Terms from time to time.
                </Typography>
                <Typography color="text.secondary" sx={bodyTextSx}>
                  The updated version will be published at:{' '}
                  <Link href="https://queuebooking.com/terms">
                    https://queuebooking.com/terms
                  </Link>
                </Typography>
              </TermsSection>

              <TermsSection title="Governing Law">
                <Typography color="text.secondary" sx={bodyTextSx}>
                  These Terms shall be governed by the laws of the Kingdom of Thailand.
                </Typography>
              </TermsSection>

              <TermsSection title="Contact">
                <Typography fontWeight={800}>Go Along Co., Ltd.</Typography>
                <Stack spacing={0.5}>
                  <Typography fontWeight={700}>Website</Typography>
                  <Link href="https://queuebooking.com" target="_blank" rel="noreferrer">
                    https://queuebooking.com
                  </Link>
                </Stack>
                <Stack spacing={0.5}>
                  <Typography fontWeight={700}>Email</Typography>
                  <Link href="mailto:amnart.gl@gmail.com">amnart.gl@gmail.com</Link>
                </Stack>
              </TermsSection>
            </Stack>
          </Paper>
        </Container>
      </Box>
      <LandingFooter />
    </>
  );
}
