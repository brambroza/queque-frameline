import { requirePageAccess } from '@/lib/auth/page-roles';
import { PageShell } from '@/components/ui/page-shell';
import { CalendarClient } from '@/components/bookings/calendar-client';

export default async function CalendarPage() {
  await requirePageAccess('calendar');
  return (
    <PageShell title="Calendar" description="ปฏิทินคิวรายวัน">
      <CalendarClient />
    </PageShell>
  );
}
