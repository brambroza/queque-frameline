import { PageShell } from '@/components/ui/page-shell';

/** Shown when the signed-in account has no menu at all — an admin must assign a role. */
export default function NoAccessPage() {
  return (
    <PageShell title="ยังไม่มีสิทธิ์ใช้งาน" description="บัญชีนี้ยังไม่ได้รับสิทธิ์เมนูใด ๆ — ติดต่อผู้ดูแลระบบให้กำหนดสิทธิ์ในหน้า พนักงาน">
      <div className="card p-5 text-sm text-slate-600">เมื่อผู้ดูแลระบบกำหนดสิทธิ์แล้ว ให้ออกจากระบบและเข้าใหม่อีกครั้ง</div>
    </PageShell>
  );
}
