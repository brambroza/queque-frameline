import { PageShell } from '@/components/ui/page-shell';
import { ResourcesCrud } from '@/components/forms/resources-crud';

export default function ResourcesPage() {
  return (
    <PageShell title="Resources" description="จัดการโต๊ะอาหาร ห้องประชุม โซนบุฟเฟ่ต์ เทรนเนอร์ และทรัพยากรบริการ — ผูกกับบริการได้ (ไม่บังคับ) เช่น ครูโยคะ ↔ คลาสโยคะ">
      <ResourcesCrud />
    </PageShell>
  );
}

