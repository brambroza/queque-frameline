/**
 * Static on-screen labels for the signage. The TV runs without a session, so it
 * cannot use the DB-backed portal dictionary; keep a small fixed set here.
 */
export type SignageLabels = {
  now_calling: string;
  also_calling: string;
  next_queue: string;
  waiting: string;
  waiting_count: string;
  served_today: string;
  empty_calling: string;
  empty_next: string;
  free: string;
  queue: string;
  service: string;
  resource: string;
  time: string;
  status: string;
  status_called: string;
  status_waiting: string;
  scan_to_book: string;
  demo_mode: string;
  offline: string;
  disabled_title: string;
  disabled_body: string;
  please_proceed: string;
};

export const SIGNAGE_LABELS_TH: SignageLabels = {
  now_calling: 'กำลังเรียกคิว',
  also_calling: 'กำลังเรียก',
  next_queue: 'คิวถัดไป',
  waiting: 'รอเรียก',
  waiting_count: 'รออีก',
  served_today: 'ให้บริการแล้ว',
  empty_calling: 'ยังไม่มีคิวที่กำลังเรียก',
  empty_next: 'ยังไม่มีคิวถัดไป',
  free: 'ว่าง',
  queue: 'คิว',
  service: 'บริการ',
  resource: 'โต๊ะ / ห้อง',
  time: 'เวลา',
  status: 'สถานะ',
  status_called: 'เชิญได้เลย',
  status_waiting: 'รอเรียก',
  scan_to_book: 'สแกนเพื่อจองคิวผ่าน LINE',
  demo_mode: 'โหมดทดลอง',
  offline: 'ขาดการเชื่อมต่อ กำลังลองใหม่',
  disabled_title: 'จอแสดงคิวปิดใช้งาน',
  disabled_body: 'เจ้าของร้านสามารถเปิดใช้งานได้ที่เมนู จอแสดงคิว',
  please_proceed: 'เชิญที่',
};

export const SIGNAGE_LABELS_EN: SignageLabels = {
  now_calling: 'Now calling',
  also_calling: 'Calling',
  next_queue: 'Next',
  waiting: 'Waiting',
  waiting_count: 'More waiting',
  served_today: 'Served today',
  empty_calling: 'No queue being called yet',
  empty_next: 'No upcoming queue',
  free: 'Free',
  queue: 'Queue',
  service: 'Service',
  resource: 'Table / Room',
  time: 'Time',
  status: 'Status',
  status_called: 'Please proceed',
  status_waiting: 'Waiting',
  scan_to_book: 'Scan to book via LINE',
  demo_mode: 'Demo mode',
  offline: 'Connection lost, retrying',
  disabled_title: 'Queue display is turned off',
  disabled_body: 'The shop owner can enable it from the Queue Display menu',
  please_proceed: 'Go to',
};

/** Pick a label set by language code, defaulting to Thai. */
export function getSignageLabels(lang?: string | null): SignageLabels {
  return lang === 'en' ? SIGNAGE_LABELS_EN : SIGNAGE_LABELS_TH;
}
