import { HolidaysCrud } from '@/components/forms/holidays-crud';
import { PageShell } from '@/components/ui/page-shell';

export default function HolidaysPage() {
  return (
    <PageShell title="Holidays" description="กำหนดวันหยุดของร้านและรายสาขา">
      <HolidaysCrud />
    </PageShell>
  );
}
