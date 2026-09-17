import Link from 'next/link';
import Image from 'next/image';
import type { SvgIconComponent } from '@mui/icons-material';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Grid,
  Stack,
  Typography,
} from '@mui/material';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import { LandingNavbar } from '@/components/public/landing-navbar';
import { LandingFooter } from '@/components/public/landing-footer';
import { FaqSection } from '@/components/public/faq-section';

export type SolutionUseCase = { title: string; desc: string; icon: SvgIconComponent };
export type SolutionFeature = { title: string; desc: string; icon: SvgIconComponent };
export type SolutionFaq = { q: string; a: string };
export type SolutionPreview = { title: string; image: string; alt: string };

/**
 * Content contract for a `/solutions/<slug>` landing page.
 * Every field is plain data so the page itself stays a server component
 * and the JSON-LD blocks can be derived without duplication.
 */
export type SolutionPageContent = {
  /** Path under the app origin, e.g. `/solutions/badminton-court-booking-system`. */
  path: string;
  /** Short English badge shown above the hero headline. */
  badge: string;
  heroTitle: string;
  heroSubtitle: string;
  heroPills: string[];
  /** Card on the right of the hero: heading + 4 reasons. */
  whyTitle: string;
  whyItems: string[];
  painTitle: string;
  painPoints: string[];
  featuresTitle: string;
  solutionFeatures: string[];
  stepsTitle: string;
  steps: string[];
  useCasesTitle: string;
  useCases: SolutionUseCase[];
  benefitsTitle: string;
  benefits: string[];
  featureHighlights: SolutionFeature[];
  previewItems: SolutionPreview[];
  faqItems: SolutionFaq[];
  ctaTitle: string;
  ctaSubtitle: string;
  /** Used for the SoftwareApplication JSON-LD description. */
  schemaDescription: string;
};

const cardSx = { height: '100%', borderRadius: 2, border: '1px solid', borderColor: 'divider', boxShadow: 'none' } as const;
const bandSx = { py: 7, bgcolor: '#FAFBF8', borderTop: '1px solid', borderBottom: '1px solid', borderColor: 'divider' } as const;
const primaryBtnSx = { bgcolor: '#12a862', '&:hover': { bgcolor: '#0a7043' } } as const;
const outlinedBtnSx = { borderColor: '#12a862', color: '#12a862' } as const;

/**
 * Shared renderer for industry solution pages (`/solutions/*`).
 * Layout mirrors the barbershop / clinic / restaurant pages so all
 * solutions read as one family; only the content differs.
 */
export function SolutionPage({ content }: { content: SolutionPageContent }) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://queuebooking.com';
  const canonical = `${appUrl}${content.path}`;

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: content.faqItems.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    })),
  };

  const softwareSchema = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'QueueBooking',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    inLanguage: ['th'],
    description: content.schemaDescription,
    url: canonical,
    offers: { '@type': 'Offer', priceCurrency: 'THB', availability: 'https://schema.org/InStock' },
  };

  const organizationSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'QueueBooking LINE',
    url: appUrl,
    contactPoint: [
      { '@type': 'ContactPoint', contactType: 'sales', email: 'amnart.gl@gmail.com', telephone: '+66-85-608-3298' },
    ],
  };

  return (
    <main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }} />

      <LandingNavbar />

      <Box
        sx={{
          py: { xs: 7, md: 9 },
          borderBottom: '1px solid',
          borderColor: 'divider',
          background:
            'radial-gradient(circle at top right, rgba(115,192,136,0.14), transparent 30%), linear-gradient(180deg, #ffffff 0%, #fbfcfb 100%)',
        }}
      >
        <Container maxWidth="lg">
          <Grid container spacing={3} alignItems="center">
            <Grid size={{ xs: 12, md: 7 }}>
              <Chip label={content.badge} sx={{ bgcolor: '#EAF3DE', color: '#0a7043', fontWeight: 700 }} />
              <Typography variant="h3" component="h1" sx={{ mt: 2, fontWeight: 800, fontSize: { xs: 30, md: 44 }, lineHeight: 1.2 }}>
                {content.heroTitle}
              </Typography>
              <Typography color="text.secondary" sx={{ mt: 2, maxWidth: 720, lineHeight: 1.8 }}>
                {content.heroSubtitle}
              </Typography>

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.2} sx={{ mt: 3 }}>
                <Button component={Link} href="/register" variant="contained" sx={primaryBtnSx}>
                  ทดลองใช้งานฟรี
                </Button>
                <Button component={Link} href="/contact" variant="outlined" sx={outlinedBtnSx}>
                  ขอเดโม
                </Button>
              </Stack>

              <Stack direction="row" spacing={1.1} useFlexGap flexWrap="wrap" sx={{ mt: 3 }}>
                {content.heroPills.map((pill) => (
                  <Chip
                    key={pill}
                    icon={<CheckCircleRoundedIcon sx={{ color: '#0a7043 !important' }} />}
                    label={pill}
                    sx={{ bgcolor: '#F3F8EC' }}
                  />
                ))}
              </Stack>
            </Grid>

            <Grid size={{ xs: 12, md: 5 }}>
              <Card sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider', boxShadow: 'none' }}>
                <CardContent>
                  <Typography fontWeight={700} sx={{ mb: 1.2 }}>
                    {content.whyTitle}
                  </Typography>
                  <Stack spacing={1}>
                    {content.whyItems.map((item) => (
                      <Stack key={item} direction="row" spacing={1} alignItems="center">
                        <CheckCircleRoundedIcon sx={{ color: '#12a862', fontSize: 18 }} />
                        <Typography variant="body2" color="text.secondary">
                          {item}
                        </Typography>
                      </Stack>
                    ))}
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Container>
      </Box>

      <Container maxWidth="lg" sx={{ py: 7 }}>
        <Typography variant="h4" component="h2" sx={{ fontWeight: 800, mb: 2 }}>
          {content.painTitle}
        </Typography>
        <Grid container spacing={1.5}>
          {content.painPoints.map((item) => (
            <Grid key={item} size={{ xs: 12, sm: 6, md: 4 }}>
              <Card sx={cardSx}>
                <CardContent>
                  <Typography fontWeight={700}>{item}</Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Container>

      <Box sx={bandSx}>
        <Container maxWidth="lg">
          <Typography variant="h4" component="h2" sx={{ fontWeight: 800, mb: 2 }}>
            {content.featuresTitle}
          </Typography>
          <Grid container spacing={1.5}>
            {content.solutionFeatures.map((item) => (
              <Grid key={item} size={{ xs: 12, sm: 6, md: 4 }}>
                <Stack
                  direction="row"
                  spacing={1}
                  alignItems="center"
                  sx={{ p: 1.5, borderRadius: 2, bgcolor: '#fff', border: '1px solid', borderColor: 'divider', height: '100%' }}
                >
                  <CheckCircleRoundedIcon sx={{ color: '#12a862' }} />
                  <Typography>{item}</Typography>
                </Stack>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      <Container maxWidth="lg" sx={{ py: 7 }}>
        <Typography variant="h4" component="h2" sx={{ fontWeight: 800, mb: 2 }}>
          {content.stepsTitle}
        </Typography>
        <Grid container spacing={1.5}>
          {content.steps.map((step, index) => (
            <Grid key={step} size={{ xs: 12, sm: 6, md: 4 }}>
              <Card sx={cardSx}>
                <CardContent>
                  <Typography sx={{ color: '#12a862', fontWeight: 800 }}>Step {index + 1}</Typography>
                  <Typography sx={{ mt: 0.8 }} fontWeight={700}>
                    {step}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Container>

      <Box sx={bandSx}>
        <Container maxWidth="lg">
          <Typography variant="h4" component="h2" sx={{ fontWeight: 800, mb: 2 }}>
            {content.useCasesTitle}
          </Typography>
          <Grid container spacing={1.5}>
            {content.useCases.map((item) => {
              const Icon = item.icon;
              return (
                <Grid key={item.title} size={{ xs: 12, sm: 6, md: 3 }}>
                  <Card sx={cardSx}>
                    <CardContent>
                      <Box sx={{ width: 40, height: 40, borderRadius: 1.5, bgcolor: '#EAF3DE', display: 'grid', placeItems: 'center', mb: 1 }}>
                        <Icon sx={{ color: '#0a7043' }} />
                      </Box>
                      <Typography fontWeight={800}>{item.title}</Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.8 }}>
                        {item.desc}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        </Container>
      </Box>

      <Container maxWidth="lg" sx={{ py: 7 }}>
        <Typography variant="h4" component="h2" sx={{ fontWeight: 800, mb: 2 }}>
          {content.benefitsTitle}
        </Typography>
        <Grid container spacing={1.5}>
          {content.benefits.map((item) => (
            <Grid key={item} size={{ xs: 12, sm: 6, md: 3 }}>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ p: 1.5, borderRadius: 2, border: '1px solid', borderColor: 'divider', height: '100%' }}>
                <CheckCircleRoundedIcon sx={{ color: '#12a862' }} />
                <Typography>{item}</Typography>
              </Stack>
            </Grid>
          ))}
        </Grid>
      </Container>

      <Box sx={bandSx}>
        <Container maxWidth="lg">
          <Typography variant="h4" component="h2" sx={{ fontWeight: 800, mb: 2 }}>
            ฟีเจอร์เด่นของระบบ
          </Typography>
          <Grid container spacing={1.5}>
            {content.featureHighlights.map((item) => {
              const Icon = item.icon;
              return (
                <Grid key={item.title} size={{ xs: 12, sm: 6, md: 4 }}>
                  <Card sx={cardSx}>
                    <CardContent>
                      <Stack direction="row" spacing={1.2} alignItems="center">
                        <Box sx={{ width: 40, height: 40, borderRadius: 1.5, bgcolor: '#EAF3DE', display: 'grid', placeItems: 'center' }}>
                          <Icon sx={{ color: '#0a7043' }} />
                        </Box>
                        <Typography fontWeight={800}>{item.title}</Typography>
                      </Stack>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        {item.desc}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        </Container>
      </Box>

      <Container maxWidth="lg" sx={{ py: 7 }}>
        <Typography variant="h4" component="h2" sx={{ fontWeight: 800, mb: 2 }}>
          Dashboard Preview
        </Typography>
        <Grid container spacing={1.5}>
          {content.previewItems.map((item) => (
            <Grid key={item.title} size={{ xs: 12, sm: 6 }}>
              <Card sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider', boxShadow: 'none', overflow: 'hidden' }}>
                <Box sx={{ p: 1.2, borderBottom: '1px solid', borderColor: 'divider' }}>
                  <Typography fontWeight={700}>{item.title}</Typography>
                </Box>
                <Box sx={{ p: 1.2 }}>
                  <Image
                    src={item.image}
                    alt={item.alt}
                    width={1200}
                    height={900}
                    loading="lazy"
                    style={{ width: '100%', height: 'auto', borderRadius: 8, border: '1px solid #e5e7eb' }}
                  />
                </Box>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Container>

      <FaqSection items={content.faqItems} />

      <Container maxWidth="lg" sx={{ pb: 8 }}>
        <Box sx={{ p: { xs: 3, md: 4 }, borderRadius: 3, bgcolor: '#F2F8F4', border: '1px solid #DDEBDD' }}>
          <Typography variant="h4" component="h2" sx={{ fontWeight: 800, fontSize: { xs: 26, md: 34 } }}>
            {content.ctaTitle}
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 1 }}>
            {content.ctaSubtitle}
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.2} sx={{ mt: 2.5 }}>
            <Button component={Link} href="/register" variant="contained" sx={primaryBtnSx}>
              ทดลองใช้งานฟรี
            </Button>
            <Button component={Link} href="/contact" variant="outlined" sx={outlinedBtnSx}>
              ขอเดโม
            </Button>
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mt: 2.5 }}>
            <Link href="/">หน้าแรก</Link>
            <Link href="/pricing">ดูราคา</Link>
            <Link href="/contact">ติดต่อทีมงาน</Link>
            <Link href="/sandbox-demo">ทดลอง Sandbox</Link>
          </Stack>
        </Box>
      </Container>

      <LandingFooter />
    </main>
  );
}
