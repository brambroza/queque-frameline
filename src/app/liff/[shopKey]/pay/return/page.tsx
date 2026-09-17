import { DeeplinkReturnClient } from '@/components/line/deeplink-return-client';

/**
 * Landing page the bank app returns the customer to after a deeplink payment.
 * Runs in the system browser (outside LIFF), so it authenticates with the
 * HMAC token in the URL and offers a way back into LINE.
 */
export default async function DeeplinkReturnPage({
  params,
  searchParams,
}: {
  params: Promise<{ shopKey: string }>;
  searchParams: Promise<{ booking_id?: string; t?: string }>;
}) {
  const { shopKey } = await params;
  const { booking_id: bookingId = '', t: token = '' } = await searchParams;
  return <DeeplinkReturnClient shopKey={shopKey} bookingId={bookingId} token={token} />;
}
