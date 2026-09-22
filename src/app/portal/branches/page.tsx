import { requirePageAccess } from '@/lib/auth/page-roles';
import { PageShell } from '@/components/ui/page-shell';
import { BranchesCrud } from '@/components/forms/branches-crud';

export default async function BranchesPage() {
  await requirePageAccess('branches');
  return (
    <PageShell title="สาขา / คลัง" description="แต่ละสาขามีท่า เวลาทำการ และวันหยุดของตัวเอง — รหัสสาขาใช้ระบุสาขาในไฟล์ CSV และข้อมูลจาก ERP · ใส่พิกัดคลังเพื่อให้คนขับเช็คอินเองได้เมื่อมาถึง">
      <BranchesCrud />
    </PageShell>
  );
}
