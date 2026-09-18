import { PageShell } from '@/components/ui/page-shell';
import { SimpleCrud } from '@/components/forms/simple-crud';

export default function BranchesPage() {
  return (
    <PageShell title="สาขา / คลัง" description="แต่ละสาขามีท่า เวลาทำการ และวันหยุดของตัวเอง — รหัสสาขาใช้ระบุสาขาในไฟล์ CSV และข้อมูลจาก ERP">
      <SimpleCrud
        endpoint="/api/branches"
        title="สาขา"
        defaults={{ max_parallel_queues: 1, active: true, open_time: '09:00', close_time: '18:00' }}
        columns={[
          { key: 'code', label: 'รหัสสาขา' },
          { key: 'branch_name', label: 'ชื่อสาขา' },
          { key: 'address', label: 'ที่อยู่' },
          { key: 'phone', label: 'เบอร์โทร' },
          { key: 'open_time', label: 'เวลาเปิด', type: 'time' },
          { key: 'close_time', label: 'เวลาปิด', type: 'time' },
          { key: 'max_parallel_queues', label: 'จำนวนคิวพร้อมกัน (ไม่ใช้กับท่า)', type: 'number' },
          { key: 'active', label: 'เปิดใช้งาน', type: 'checkbox' },
        ]}
      />
    </PageShell>
  );
}
