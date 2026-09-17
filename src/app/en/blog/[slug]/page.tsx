import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import { Box, Button, Chip, Container, Divider, Paper, Stack, Typography } from '@mui/material';
import { LandingNavbar } from '@/components/public/landing-navbar';
import { LandingFooter } from '@/components/public/landing-footer';
import { blogPostsEn, getBlogBySlugEn } from '@/components/public/blog-content-en';
import { formatDateDMY } from '@/lib/utils/date-format';

type Params = { slug: string };

export function generateStaticParams() {
  return blogPostsEn.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const post = getBlogBySlugEn(slug);
  if (!post) return {};
  return {
    title: `${post.title} | ระบบจองคิวผ่าน LINE OA | QueueBooking LINE`,
    description: post.description,
    alternates: {
      canonical: `/en/blog/${post.slug}`,
      languages: {
        'th-TH': `/blog/${post.slug}`,
        'en-US': `/en/blog/${post.slug}`,
        'x-default': `/blog/${post.slug}`,
      },
    },
    openGraph: {
      title: post.title,
      description: post.description,
      url: `/en/blog/${post.slug}`,
      type: 'article',
      locale: 'en_US',
    },
  };
}

export default async function BlogDetailEnPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const post = getBlogBySlugEn(slug);
  if (!post) notFound();

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://queuebooking.com';
  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.description,
    datePublished: `${post.publishedAt}T00:00:00+07:00`,
    dateModified: `${post.publishedAt}T00:00:00+07:00`,
    inLanguage: 'en-US',
    author: {
      '@type': 'Organization',
      name: 'QueueBooking LINE',
    },
    publisher: {
      '@type': 'Organization',
      name: 'QueueBooking LINE',
    },
    mainEntityOfPage: `${appUrl}/en/blog/${post.slug}`,
  };

  return (
    <main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <LandingNavbar />
      <Container maxWidth="md" sx={{ py: 8 }}>
        <Stack spacing={1}>
          <Chip label={post.category} size="small" sx={{ width: 'fit-content' }} />
          <Typography variant="h3" fontWeight={800}>{post.title}</Typography>
          <Typography color="text.secondary">
            {formatDateDMY(post.publishedAt)} • {post.readingMinutes} min read
          </Typography>
        </Stack>
        <Divider sx={{ my: 3 }} />

        <Stack spacing={3}>
          {post.sections.map((s) => (
            <Box key={s.heading}>
              <Typography variant="h5" fontWeight={700} sx={{ mb: 1.2 }}>{s.heading}</Typography>
              <Stack spacing={1.2}>
                {s.body.map((p) => (
                  <Typography key={p} color="text.secondary">{p}</Typography>
                ))}
              </Stack>
            </Box>
          ))}
        </Stack>

        {post.assets?.pdfUrl || (post.assets?.images?.length ?? 0) > 0 ? (
          <Paper
            sx={{
              mt: 4,
              p: { xs: 2, md: 3 },
              borderRadius: 2,
              border: '1px solid',
              borderColor: 'divider',
              background: 'linear-gradient(135deg,#fff 0%,#f8fbf8 100%)',
            }}
          >
            <Typography variant="h5" fontWeight={800}>Attachments and setup screenshots</Typography>
            <Typography color="text.secondary" sx={{ mt: 0.5 }}>
              Compare your LINE console values with these examples before verifying and publishing.
            </Typography>

            {post.assets?.pdfUrl ? (
              <Button
                component={Link}
                href={post.assets.pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                variant="contained"
                sx={{ mt: 2 }}
              >
                {post.assets.pdfLabel ?? 'Download PDF guide'}
              </Button>
            ) : null}

            <Stack spacing={2} sx={{ mt: 2.5 }}>
              {post.assets?.images?.map((img) => (
                <Box
                  key={img.src}
                  sx={{
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 2,
                    overflow: 'hidden',
                    bgcolor: '#fff',
                  }}
                >
                  <Box sx={{ position: 'relative', width: '100%', height: { xs: 180, md: 320 } }}>
                    <Image src={img.src} alt={img.alt} fill style={{ objectFit: 'cover' }} />
                  </Box>
                  <Box sx={{ p: 1.5 }}>
                    <Typography variant="body2" color="text.secondary">{img.caption}</Typography>
                  </Box>
                </Box>
              ))}
            </Stack>
          </Paper>
        ) : null}

        <Box sx={{ mt: 4 }}>
          <Typography>
            <Link href="/register">Start free</Link> or <Link href="/en/contact">Contact sales</Link>
          </Typography>
          <Typography sx={{ mt: 1 }}>
            <Link href="/en/blog">← Back to all articles</Link>
          </Typography>
        </Box>
      </Container>
      <LandingFooter />
    </main>
  );
}
