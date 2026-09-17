import { PageShell } from '@/components/ui/page-shell';
import { PaymentVerificationInbox } from '@/components/forms/payment-verification-inbox';

export default async function PaymentVerificationPage({
  searchParams,
}: {
  searchParams: Promise<{ booking_id?: string }>;
}) {
  const { booking_id: bookingId } = await searchParams;

  return (
    <PageShell title="ตรวจสอบการชำระเงิน" description="สลิปโอนเงินที่ลูกค้าอัปโหลดเข้ามา รอการตรวจสอบ">
      <PaymentVerificationInbox initialBookingId={bookingId} />
    </PageShell>
  );
}
