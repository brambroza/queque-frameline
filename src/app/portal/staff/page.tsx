import { requirePageAccess } from '@/lib/auth/page-roles';
import { PageShell } from '@/components/ui/page-shell';
import { StaffPageTabs } from '@/components/forms/staff-page-tabs';

export default async function StaffPage() {
  const { isAdmin } = await requirePageAccess('staff');
  return (
    <PageShell title="พนักงาน" description="จัดการพนักงาน สาขาที่รับผิดชอบ และสิทธิ์เมนูของแต่ละตำแหน่ง">
      <StaffPageTabs isAdmin={isAdmin} />
    </PageShell>
  );
}
