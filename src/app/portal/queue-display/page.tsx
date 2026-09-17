import { PageShell } from '@/components/ui/page-shell';
import { SignageDesignerClient } from '@/components/signage/designer/signage-designer-client';

export default function QueueDisplayPage() {
  return (
    <PageShell title="จอแสดงคิว (Digital Signage)" description="เลือกเทมเพลต ปรับสี แล้วเปิดบนจอ TV หน้าร้าน ระบบอัปเดตคิวให้อัตโนมัติ">
      <SignageDesignerClient />
    </PageShell>
  );
}
