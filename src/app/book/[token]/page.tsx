import type { Metadata } from 'next';
import { BookingClient } from '@/components/public-booking/booking-client';

export const metadata: Metadata = { title: 'จองคิว', robots: { index: false, follow: false }, referrer: 'no-referrer' };

/** Self-booking page for one SO / PO. The token in the URL is the only credential. */
export default async function BookPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <BookingClient token={token} />;
}
