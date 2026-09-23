import { requirePageAccess } from '@/lib/auth/page-roles';
import { PageShell } from '@/components/ui/page-shell';

/** Where to find the yard TV page. */
export default async function QueueDisplayPage() {
  await requirePageAccess('queue_display');
  const base = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/+$/, '');
  const needsKey = Boolean(process.env.DISPLAY_KEY);
  return (
    <PageShell title="จอเรียกคิว" description="เปิดหน้านี้บนทีวีหน้าลานจอด — แสดงท่า คิวที่ถูกเรียก ทะเบียนรถ และประกาศเสียงภาษาไทย">
      <div className="card space-y-3 p-5 text-sm">
        <p>
          URL สำหรับทีวี: <a className="font-semibold text-emerald-700 underline" href="/display" target="_blank" rel="noreferrer">{base}/display{needsKey ? '?key=…' : ''}</a>
        </p>
        <ul className="list-disc space-y-1 pl-5 text-slate-600">
          <li>อัปเดตทุก 5 วินาที ไม่ต้องล็อกอิน</li>
          <li>แตะหน้าจอ 1 ครั้งหลังเปิด เพื่ออนุญาตเสียงเรียกคิว (ข้อกำหนดของเบราว์เซอร์)</li>
          <li>แสดงเลขคิว ทะเบียนรถ (ตามรูปแบบของประเภทรถ) ประเภทรถ เวลานัด เลข SO/PO ชื่อลูกค้า ชื่อคนขับ ท่า และเลข DO — ไม่แสดงเบอร์โทร</li>
          <li>{needsKey ? 'ตั้งค่า DISPLAY_KEY ไว้แล้ว: ต้องใส่ ?key= ให้ตรงกับค่าใน env' : 'ต้องการจำกัดการเข้าถึง: ตั้ง env DISPLAY_KEY แล้วเปิดด้วย /display?key=ค่านั้น'}</li>
        </ul>
      </div>
    </PageShell>
  );
}
