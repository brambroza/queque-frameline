import { PageShell } from '@/components/ui/page-shell';
import { CustomersCrud } from '@/components/forms/customers-crud';

export default function CustomersPage() {
  return (
    <PageShell title="Customers" description="จัดการข้อมูลลูกค้าแบบมืออาชีพ">
      <CustomersCrud />
    </PageShell>
  );
}
