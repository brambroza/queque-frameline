import { requirePageAccess } from '@/lib/auth/page-roles';
import { HolidaysCrud } from '@/components/forms/holidays-crud';
import { PageShell } from '@/components/ui/page-shell';

export default async function HolidaysPage() {
  const { canWrite } = await requirePageAccess('holidays');
  return (
    <PageShell title="Holidays" description="กำหนดวันหยุดของร้านและรายสาขา">
      <HolidaysCrud canWrite={canWrite('holidays')} />
    </PageShell>
  );
}
