'use client';

import { useMemo } from 'react';
import { usePathname } from 'next/navigation';

const SEGMENT_LABELS: Record<string, string> = {
  en: 'English',
  blog: 'Blog',
  contact: 'Contact',
  pricing: 'Pricing',
  'use-cases': 'Use Cases',
  solutions: 'Solutions',
  'sandbox-demo': 'Sandbox Demo',
  portal: 'Portal',
  login: 'Login',
  register: 'Register',
  liff: 'LIFF',
  display: 'Display',
};

function toTitleCase(input: string) {
  return input
    .replace(/[-_]/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function BreadcrumbSchema() {
  const pathname = usePathname();

  const schema = useMemo(() => {
    const base = process.env.NEXT_PUBLIC_APP_URL || 'https://queuebooking.com';
    const normalizedPath = pathname && pathname !== '' ? pathname : '/';

    const parts = normalizedPath.split('/').filter(Boolean);
    const items: Array<{ '@type': 'ListItem'; position: number; name: string; item: string }> = [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: `${base}/`,
      },
    ];

    let currentPath = '';
    parts.forEach((part, index) => {
      currentPath += `/${part}`;
      const name = SEGMENT_LABELS[part] || toTitleCase(decodeURIComponent(part));
      items.push({
        '@type': 'ListItem',
        position: index + 2,
        name,
        item: `${base}${currentPath}`,
      });
    });

    return {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: items,
    };
  }, [pathname]);

  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />;
}
