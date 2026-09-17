import { PageShell } from '@/components/ui/page-shell';
import { WorkingHoursCrud } from '@/components/forms/working-hours-crud';

export default function WorkingHoursPage() {
  return (
    <PageShell title="Working Hours" description="กำหนดเวลาทำการและสล็อตคิว">
      <WorkingHoursCrud />
    </PageShell>
  );
}
