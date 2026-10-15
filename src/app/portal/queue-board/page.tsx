import { PageShell } from '@/components/ui/page-shell';
import { QueueBoardClient } from '@/components/bookings/queue-board-client';
import { requirePageAccess } from '@/lib/auth/page-roles';

export default async function QueueBoardPage() {
  const { isAdmin, canWrite } = await requirePageAccess('queue_board');
  return (
    <PageShell title="บอร์ดคิว" description="สถานะรถทุกคันของวันนี้ — เช็คอิน เรียกเข้าท่า และปิดงาน">
      {/* No write switch on this menu = the board is shown without any control that changes a queue. */}
      <QueueBoardClient isAdmin={isAdmin} readOnly={!canWrite('queue_board')} />
    </PageShell>
  );
}
