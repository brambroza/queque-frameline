import type { Metadata } from 'next';
import { DriverClient } from '@/components/public-booking/driver-client';

export const metadata: Metadata = { title: 'งานของคนขับ', robots: { index: false, follow: false }, referrer: 'no-referrer' };

/** Driver's read-only job page. The token in the URL is the only credential. */
export default async function DriverPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <DriverClient token={token} />;
}
