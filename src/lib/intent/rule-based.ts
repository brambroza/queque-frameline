export type Intent =
  | 'ask_available_slots'
  | 'book_queue'
  | 'cancel_booking'
  | 'reschedule_booking'
  | 'check_my_booking'
  | 'ask_shop_info'
  | 'contact_staff'
  | 'unknown';

export interface ParsedIntent {
  intent: Intent;
  date?: string;
  time?: string;
  raw: string;
}

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function parseDate(text: string): string | undefined {
  const now = new Date();
  if (/วันนี้/.test(text)) return toISODate(now);
  if (/พรุ่งนี้/.test(text)) return toISODate(new Date(now.getTime() + 24 * 60 * 60 * 1000));

  const dm = text.match(/(?:วันที่\s*)?(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?/);
  if (dm) {
    const dd = Number(dm[1]);
    const mm = Number(dm[2]);
    const yyyy = dm[3] ? Number(dm[3].length === 2 ? `20${dm[3]}` : dm[3]) : now.getFullYear();
    const d = new Date(yyyy, mm - 1, dd);
    if (!Number.isNaN(d.getTime())) return toISODate(d);
  }
  return undefined;
}

function parseTime(text: string): string | undefined {
  const m = text.match(/(\d{1,2})[:\.](\d{2})/);
  if (!m) return undefined;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return undefined;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00`;
}

export function parseIntent(text: string): ParsedIntent {
  const t = text.toLowerCase().trim();
  const date = parseDate(t);
  const time = parseTime(t);

  if (/คิวว่าง|ว่างไหม|มีคิว|ช่วงบ่าย|ช่วงเช้า/.test(t)) return { intent: 'ask_available_slots', date, time, raw: text };
  if (/จองคิว|จอง|นัด/.test(t)) return { intent: 'book_queue', date, time, raw: text };
  if (/ยกเลิกคิว|ยกเลิก/.test(t)) return { intent: 'cancel_booking', date, time, raw: text };
  if (/เลื่อนนัด|เลื่อนคิว|เปลี่ยนเวลา/.test(t)) return { intent: 'reschedule_booking', date, time, raw: text };
  if (/เช็คคิว|คิวของฉัน|นัดของฉัน/.test(t)) return { intent: 'check_my_booking', date, time, raw: text };
  if (/ข้อมูลร้าน|ที่อยู่|เวลาเปิดปิด|เบอร์ติดต่อ/.test(t)) return { intent: 'ask_shop_info', date, time, raw: text };
  if (/ติดต่อ|เจ้าหน้าที่|พนักงาน|แอดมิน/.test(t)) return { intent: 'contact_staff', date, time, raw: text };
  return { intent: 'unknown', date, time, raw: text };
}
