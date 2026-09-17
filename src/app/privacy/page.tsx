import type { Metadata } from 'next';
import { Box, Container, Divider, Link, Paper, Stack, Typography } from '@mui/material';
import { LandingFooter } from '@/components/public/landing-footer';
import { LandingNavbar } from '@/components/public/landing-navbar';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'QueueBooking privacy policy, including how Go Along Co., Ltd. collects, uses, stores, and protects personal and Google user data.',
  alternates: { canonical: '/privacy' },
  robots: { index: true, follow: true },
};

const collectedInformation = [
  'Name',
  'Email address',
  'Telephone number',
  'Company name',
  'LINE User ID',
  'Booking information',
  'Appointment details',
  'Device information',
  'Browser information',
  'IP address',
  'Cookies',
  'Usage logs',
];

const googleInformation = [
  'Google Account Name',
  'Email Address',
  'Profile Picture (if authorized)',
];

const informationUses = [
  'Create and manage your account',
  'Provide booking and appointment services',
  'Send booking confirmations',
  'Send notifications through LINE Official Account',
  'Improve our services',
  'Provide customer support',
  'Analyze system usage',
  'Detect fraud and abuse',
  'Comply with legal obligations',
];

const thirdPartyServices = [
  'Google',
  'LINE',
  'Microsoft',
  'Zoom',
  'Stripe',
  'Omise',
  'Payment Providers',
  'Analytics Services',
];

const cookieUses = [
  'Keep you signed in',
  'Remember preferences',
  'Improve website performance',
  'Analyze website traffic',
];

const securityMeasures = [
  'HTTPS Encryption',
  'Secure Cloud Infrastructure',
  'Access Control',
  'Authentication',
  'Backup',
  'Activity Logging',
];

const userRights = [
  'Access your information',
  'Correct inaccurate information',
  'Delete your information',
  'Withdraw consent',
  'Request data portability',
  'Restrict processing where applicable',
];

function PolicyList({ items }: { items: string[] }) {
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

function PolicySection({ title, children }: { title: string; children: React.ReactNode }) {
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

export default function PrivacyPage() {
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
              Privacy Policy
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
                  QueueBooking (&quot;Service&quot;, &quot;we&quot;, &quot;our&quot;, or
                  &quot;us&quot;) is an online booking and queue management platform developed and
                  operated by <strong>Go Along Co., Ltd.</strong> (&quot;Company&quot;).
                </Typography>
                <Typography color="text.secondary" sx={bodyTextSx}>
                  We are committed to protecting your privacy and handling your personal
                  information in accordance with applicable privacy laws, including the Personal
                  Data Protection Act (PDPA) of Thailand.
                </Typography>
              </Stack>

              <PolicySection title="About QueueBooking">
                <Typography color="text.secondary" sx={bodyTextSx}>
                  QueueBooking is a cloud-based booking and queue management platform that helps
                  businesses manage appointments, reservations, customer queues, and LINE Official
                  Account integrations.
                </Typography>
                <Stack spacing={0.5}>
                  <Typography fontWeight={700}>Website</Typography>
                  <Link href="https://queuebooking.com" target="_blank" rel="noreferrer">
                    https://queuebooking.com
                  </Link>
                </Stack>
                <Stack spacing={0.5}>
                  <Typography fontWeight={700}>Owner</Typography>
                  <Typography color="text.secondary">
                    <strong>Go Along Co., Ltd.</strong>
                  </Typography>
                </Stack>
              </PolicySection>

              <PolicySection title="Information We Collect">
                <Typography color="text.secondary" sx={bodyTextSx}>
                  Depending on how you use our services, we may collect:
                </Typography>
                <PolicyList items={collectedInformation} />
                <Typography color="text.secondary" sx={bodyTextSx}>
                  If you sign in using Google, we may receive:
                </Typography>
                <PolicyList items={googleInformation} />
                <Typography color="text.secondary" sx={bodyTextSx}>
                  We only request Google permissions that are necessary for the features you choose
                  to use.
                </Typography>
              </PolicySection>

              <PolicySection title="How We Use Your Information">
                <Typography color="text.secondary" sx={bodyTextSx}>
                  Your information may be used to:
                </Typography>
                <PolicyList items={informationUses} />
              </PolicySection>

              <PolicySection title="Google User Data">
                <Typography color="text.secondary" sx={bodyTextSx}>
                  If you choose to connect your Google Account, QueueBooking only accesses the
                  Google data required to provide the requested functionality.
                </Typography>
                <Typography color="text.secondary" sx={bodyTextSx}>
                  We do not sell Google user data.
                </Typography>
                <Typography color="text.secondary" sx={bodyTextSx}>
                  Google user data is never used for advertising purposes.
                </Typography>
                <Typography color="text.secondary" sx={bodyTextSx}>
                  Google user data is never shared with third parties except when required to
                  operate the requested service or when required by law.
                </Typography>
                <Typography color="text.secondary" sx={bodyTextSx}>
                  We comply with the Google API Services User Data Policy, including the Limited Use
                  requirements where applicable.
                </Typography>
              </PolicySection>

              <PolicySection title="Third-Party Services">
                <Typography color="text.secondary" sx={bodyTextSx}>
                  QueueBooking may integrate with services such as:
                </Typography>
                <PolicyList items={thirdPartyServices} />
                <Typography color="text.secondary" sx={bodyTextSx}>
                  Each service has its own privacy policy.
                </Typography>
              </PolicySection>

              <PolicySection title="Cookies">
                <Typography color="text.secondary" sx={bodyTextSx}>
                  We use cookies to:
                </Typography>
                <PolicyList items={cookieUses} />
                <Typography color="text.secondary" sx={bodyTextSx}>
                  You may disable cookies through your browser settings.
                </Typography>
              </PolicySection>

              <PolicySection title="Data Security">
                <Typography color="text.secondary" sx={bodyTextSx}>
                  We implement appropriate technical and organizational measures to protect your
                  information, including:
                </Typography>
                <PolicyList items={securityMeasures} />
                <Typography color="text.secondary" sx={bodyTextSx}>
                  No internet transmission is completely secure; however, we continuously improve
                  our security practices.
                </Typography>
              </PolicySection>

              <PolicySection title="Data Retention">
                <Typography color="text.secondary" sx={bodyTextSx}>
                  We retain personal information only for as long as necessary to provide our
                  services, comply with legal obligations, resolve disputes, and enforce agreements.
                </Typography>
              </PolicySection>

              <PolicySection title="Your Rights">
                <Typography color="text.secondary" sx={bodyTextSx}>
                  You may request to:
                </Typography>
                <PolicyList items={userRights} />
              </PolicySection>

              <PolicySection title="Account Deletion">
                <Typography color="text.secondary" sx={bodyTextSx}>
                  Users may request deletion of their account and associated personal information by
                  contacting us at:{' '}
                  <Link href="mailto:support@queuebooking.com">support@queuebooking.com</Link>
                </Typography>
                <Typography color="text.secondary" sx={bodyTextSx}>
                  We will process deletion requests within a reasonable period unless retention is
                  required by law.
                </Typography>
              </PolicySection>

              <PolicySection title="Changes to This Policy">
                <Typography color="text.secondary" sx={bodyTextSx}>
                  We may update this Privacy Policy from time to time.
                </Typography>
                <Typography color="text.secondary" sx={bodyTextSx}>
                  The latest version will always be available at:{' '}
                  <Link href="https://queuebooking.com/privacy">
                    https://queuebooking.com/privacy
                  </Link>
                </Typography>
              </PolicySection>

              <PolicySection title="Contact">
                <Typography fontWeight={800}>Go Along Co., Ltd.</Typography>
                <Typography color="text.secondary">Owner of QueueBooking</Typography>
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
              </PolicySection>
            </Stack>
          </Paper>
        </Container>
      </Box>
      <LandingFooter />
    </>
  );
}
