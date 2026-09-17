import { PageShell } from '@/components/ui/page-shell';
import { ServicesCrud } from '@/components/forms/services-crud';

export default function ServicesPage() {
  return (
    <PageShell title="Services" description="รองรับ จองตามเวลาที่แน่นอน, เวลายืดหยุ่น, รับจำนวนต่อรอบ, walk-in และ ต้องยืนยันก่อน">
      <ServicesCrud />
    </PageShell>
  );
}
