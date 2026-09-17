import { PageShell } from '@/components/ui/page-shell';
import { SimpleCrud } from '@/components/forms/simple-crud';

export default function BranchesPage() {
  return (
    <PageShell title="Branches" description="จัดการสาขา">
      <SimpleCrud
        endpoint="/api/branches"
        title="สาขา"
        defaults={{ max_parallel_queues: 1, active: true, open_time: '09:00', close_time: '18:00' }}
        columns={[
          { key: 'branch_name', label: 'ชื่อสาขา' },
          { key: 'address', label: 'ที่อยู่' },
          { key: 'phone', label: 'เบอร์โทร' },
          { key: 'open_time', label: 'เวลาเปิด', type: 'time' },
          { key: 'close_time', label: 'เวลาปิด', type: 'time' },
          { key: 'max_parallel_queues', label: 'จำนวนคิวพร้อมกัน', type: 'number' },
          { key: 'active', label: 'เปิดใช้งาน', type: 'checkbox' },
        ]}
      />
    </PageShell>
  );
}
