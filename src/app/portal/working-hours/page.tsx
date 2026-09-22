import { requirePageAccess } from '@/lib/auth/page-roles';
import { PageShell } from '@/components/ui/page-shell';
import { WorkingHoursCrud } from '@/components/forms/working-hours-crud';

export default async function WorkingHoursPage() {
  await requirePageAccess('working_hours');
  return (
    <PageShell title="Working Hours" description="กำหนดเวลาทำการและสล็อตคิว">
      <WorkingHoursCrud />
    </PageShell>
  );
}
