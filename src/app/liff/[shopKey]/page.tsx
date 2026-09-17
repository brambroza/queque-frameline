import { LiffBookingClient } from '@/components/line/liff-booking-client';

export default async function LiffBookingPage({ params }: { params: Promise<{ shopKey: string }> }) {
  const { shopKey } = await params;
  return <LiffBookingClient shopKey={shopKey} initialTab="booking" />;
}
