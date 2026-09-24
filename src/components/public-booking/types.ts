export type PublicItem = { sku?: string | null; name: string; qty: number; uom?: string | null };

export type PublicBooking = {
  id: string;
  queue_number: string;
  status: string;
  direction: 'inbound' | 'outbound';
  booking_date: string;
  start_time: string;
  end_time: string | null;
  resource_name: string | null;
  plate_number: string | null;
  plate_number_actual: string | null;
  driver_name: string | null;
  driver_phone: string | null;
  receiver_name: string | null;
  receiver_phone: string | null;
  note: string | null;
  /** Shown to the customer when the warehouse cancels the queue. */
  cancel_reason?: string | null;
  do_number: string | null;
  do_issued_at: string | null;
  called_at: string | null;
  call_count: number | null;
  /** Set once the driver was told "dock delayed, please wait" (checked in, past appointment, not yet called). */
  wait_notified_at?: string | null;
  /** Unpaid SO with auto-cancel on: the queue is cancelled at this instant unless the payment is recorded. */
  payment_due_at?: string | null;
  /** Set once the customer was warned that the deadline is near. */
  payment_warned_at?: string | null;
  services: { service_name: string; plate_format?: string | null } | null;
  external_documents: { doc_no: string; doc_type: 'so' | 'po'; partner_name: string | null; items: PublicItem[] } | null;
  cancellable?: boolean;
  /** Customer may still change plate / driver (before check-in). */
  vehicle_editable?: boolean;
  driver_url?: string | null;
};

export const PUBLIC_STATUS: Record<string, { label: string; tone: string; hint: string }> = {
  pending: { label: 'รอเจ้าหน้าที่ยืนยัน', tone: 'bg-amber-100 text-amber-800', hint: 'เราได้รับคำขอแล้ว เมื่อยืนยันจะมีเลข DO แสดงที่หน้านี้' },
  confirmed: { label: 'ยืนยันแล้ว', tone: 'bg-emerald-100 text-emerald-800', hint: 'กรุณามาตามวันและเวลานัด แจ้งเลขคิวที่ป้อมยาม' },
  late: { label: 'เลยเวลานัด', tone: 'bg-orange-100 text-orange-800', hint: 'เลยเวลานัดแล้ว ยังเข้าได้ แต่อาจต้องรอคิวท่าว่าง' },
  checked_in: { label: 'มาถึงแล้ว · รอเรียก', tone: 'bg-violet-100 text-violet-800', hint: 'รอในลานจอด ระบบจะเรียกเมื่อท่าว่าง' },
  called: { label: 'เชิญเข้าท่า', tone: 'bg-sky-100 text-sky-800', hint: 'นำรถเข้าท่าที่ระบุได้เลย' },
  serving: { label: 'กำลังขึ้น/ลงของ', tone: 'bg-emerald-100 text-emerald-800', hint: '' },
  completed: { label: 'เสร็จสิ้น', tone: 'bg-slate-200 text-slate-700', hint: 'ขอบคุณที่ใช้บริการ' },
  cancelled: { label: 'ยกเลิกแล้ว', tone: 'bg-red-100 text-red-700', hint: '' },
  no_show: { label: 'ไม่มาตามนัด', tone: 'bg-red-100 text-red-700', hint: 'หากต้องการนัดใหม่ กรุณาติดต่อเจ้าหน้าที่' },
};

const WEEKDAY = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
const MONTH = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

/** "วันจันทร์ 21 ก.ย. 2569" without timezone drift. */
export function longThaiDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `วัน${WEEKDAY[dow]} ${d} ${MONTH[m - 1]} ${y + 543}`;
}

/** "วันจันทร์ 21 ก.ย. 2569 14:30 น." for an ISO instant, in Bangkok time (the customer may be anywhere). */
export function thaiDateTimeAt(iso: string): string {
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return iso;
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(t);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00';
  return `${longThaiDate(`${get('year')}-${get('month')}-${get('day')}`)} ${get('hour')}:${get('minute')} น.`;
}

export function shortThaiDate(iso: string): { dow: string; day: number; month: string } {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return { dow: WEEKDAY[new Date(Date.UTC(y, m - 1, d)).getUTCDay()].slice(0, 2), day: d, month: MONTH[m - 1] };
}
