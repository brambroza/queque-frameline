import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: 'Queue Display',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#070d07',
};

/** Bare layout for the TV signage: no navbar, no chrome, just the board. */
export default function DisplayLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
