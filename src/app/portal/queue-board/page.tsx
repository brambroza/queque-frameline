import { PageShell } from '@/components/ui/page-shell';
import { QueueBoardClient } from '@/components/bookings/queue-board-client';

export default function QueueBoardPage() {
  return (
    <PageShell title="Queue Board" description="กระดานคิวแบบ Kanban">
      <QueueBoardClient />
    </PageShell>
  );
}
