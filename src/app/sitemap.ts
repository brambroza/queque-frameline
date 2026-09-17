import type { MetadataRoute } from 'next';
import { useCases } from '@/components/public/content';
import { blogPosts } from '@/components/public/blog-content';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_APP_URL || 'https://queuebooking.com';
  const now = new Date();
  const defaultDate = now.toISOString().slice(0, 10);

  const staticPages: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: `${base}/pricing`, lastModified: now, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${base}/contact`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/privacy`, lastModified: now, changeFrequency: 'yearly', priority: 0.5 },
    { url: `${base}/terms`, lastModified: now, changeFrequency: 'yearly', priority: 0.5 },
    { url: `${base}/use-cases`, lastModified: now, changeFrequency: 'weekly', priority: 0.85 },
    { url: `${base}/features/promptpay-payment`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${base}/blog`, lastModified: now, changeFrequency: 'weekly', priority: 0.85 },
    { url: `${base}/solutions/restaurant-booking-system`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${base}/solutions/barbershop-booking-system`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${base}/solutions/clinic-booking-system`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${base}/solutions/badminton-court-booking-system`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${base}/solutions/tennis-court-booking-system`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${base}/solutions/bb-gun-field-booking-system`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${base}/en`, lastModified: now, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${base}/en/pricing`, lastModified: now, changeFrequency: 'weekly', priority: 0.82 },
    { url: `${base}/en/contact`, lastModified: now, changeFrequency: 'monthly', priority: 0.75 },
    { url: `${base}/en/use-cases`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${base}/en/blog`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    // /login and /register are intentionally absent: both pages set
    // robots: { index: false }, so submitting them produces
    // "Submitted URL marked noindex" errors in Search Console.
  ];

  const useCasePages: MetadataRoute.Sitemap = useCases.map((u) => ({
    url: `${base}/use-cases/${u.slug}`,
    lastModified: now,
    changeFrequency: 'weekly',
    priority: 0.75,
  }));
  const useCasePagesEn: MetadataRoute.Sitemap = useCases.map((u) => ({
    url: `${base}/en/use-cases/${u.slug}`,
    lastModified: now,
    changeFrequency: 'weekly',
    priority: 0.7,
  }));

  const blogPages: MetadataRoute.Sitemap = blogPosts.map((p) => ({
    url: `${base}/blog/${p.slug}`,
    lastModified: new Date(`${p.publishedAt || defaultDate}T00:00:00+07:00`),
    changeFrequency: 'monthly',
    priority: 0.72,
  }));
  const blogPagesEn: MetadataRoute.Sitemap = blogPosts.map((p) => ({
    url: `${base}/en/blog/${p.slug}`,
    lastModified: new Date(`${p.publishedAt || defaultDate}T00:00:00+07:00`),
    changeFrequency: 'monthly',
    priority: 0.68,
  }));

  return [...staticPages, ...useCasePages, ...useCasePagesEn, ...blogPages, ...blogPagesEn];
}
