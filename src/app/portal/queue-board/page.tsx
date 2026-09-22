import { PageShell } from '@/components/ui/page-shell';
import { QueueBoardClient } from '@/components/bookings/queue-board-client';
import { requirePageAccess } from '@/lib/auth/page-roles';

export default async function QueueBoardPage() {
  const { isAdmin } = await requirePageAccess('queue_board');
  return (
    <PageShell title="บอร์ดคิว" description="สถานะรถทุกคันของวันนี้ — เช็คอิน เรียกเข้าท่า และปิดงาน">
      <QueueBoardClient isAdmin={isAdmin} />
    </PageShell>
  );
}
