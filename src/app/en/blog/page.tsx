import type { Metadata } from 'next';
import Link from 'next/link';
import { Card, CardContent, Chip, Container, Grid, Stack, Typography } from '@mui/material';
import { LandingNavbar } from '@/components/public/landing-navbar';
import { LandingFooter } from '@/components/public/landing-footer';
import { blogPostsEn } from '@/components/public/blog-content-en';
import { formatDateDMY } from '@/lib/utils/date-format';

export const metadata: Metadata = {
  title: 'Blog | ระบบจองคิวผ่าน LINE OA | QueueBooking LINE',
  description: 'Guides and best practices for LINE OA queue booking, LIFF setup, and no-show reduction.',
  alternates: {
    canonical: '/en/blog',
    languages: {
      'th-TH': '/blog',
      'en-US': '/en/blog',
      'x-default': '/blog',
    },
  },
};

export default function BlogEnPage() {
  return (
    <main>
      <LandingNavbar />
      <Container maxWidth="lg" sx={{ py: 8 }}>
        <Typography variant="h3" fontWeight={800}>Blog & Practical Guides</Typography>
        <Typography color="text.secondary" sx={{ mt: 1, mb: 3 }}>
          Learn queue operations and implementation patterns for LINE-first service businesses.
        </Typography>

        <Grid container spacing={2}>
          {blogPostsEn.map((post) => (
            <Grid key={post.slug} size={{ xs: 12, md: 6 }}>
              <Card sx={{ borderRadius: 1, height: '100%' }}>
                <CardContent>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                    <Chip label={post.category} size="small" />
                    <Typography variant="caption" color="text.secondary">
                      {formatDateDMY(post.publishedAt)} • {post.readingMinutes} min read
                    </Typography>
                  </Stack>
                  <Typography variant="h6" fontWeight={700}>{post.title}</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>{post.description}</Typography>
                  <Stack direction="row" spacing={1} sx={{ mt: 1.4, flexWrap: 'wrap' }}>
                    {post.keywords.slice(0, 3).map((k) => <Chip key={k} label={k} size="small" variant="outlined" />)}
                  </Stack>
                  <Typography sx={{ mt: 1.8 }}>
                    <Link href={`/en/blog/${post.slug}`}>Read article</Link>
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

