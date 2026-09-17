import { PageShell } from '@/components/ui/page-shell';
import { StaffCrud } from '@/components/forms/staff-crud';

export default function StaffPage() {
  return (
    <PageShell title="พนักงาน" description="จัดการพนักงานและสาขาที่รับผิดชอบ">
      <StaffCrud />
    </PageShell>
  );
}
