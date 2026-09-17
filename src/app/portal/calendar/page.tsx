import { PageShell } from '@/components/ui/page-shell';
import { CalendarClient } from '@/components/bookings/calendar-client';

export default function CalendarPage() {
  return (
    <PageShell title="Calendar" description="ปฏิทินคิวรายวัน">
      <CalendarClient />
    </PageShell>
  );
}
