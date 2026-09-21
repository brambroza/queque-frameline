/**
 * LINE message builders for the dock queue. Pure functions returning Messaging
 * API message objects (text / Flex). Copy is Thai; keep every label short —
 * Flex text does not wrap gracefully on small phones.
 */
import type { BookingDirection } from '@/types/db';

type Flex = { type: 'flex'; altText: string; contents: Record<string, unknown> };
type Text = { type: 'text'; text: string };

const COLOR = { ink: '#15211B', muted: '#5C6B63', out: '#1F7A5A', in: '#4A4FB0', call: '#0284C7', warn: '#B45309', bad: '#B3261E', line: '#E5E7EB' };

const dirColor = (d: BookingDirection) => (d === 'outbound' ? COLOR.out : COLOR.in);
const dirLabel = (d: BookingDirection) => (d === 'outbound' ? 'รับสินค้า' : 'ส่งสินค้า');

/** "จ. 21 ก.ย. 2569" */
export function thaiDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return iso;
  const dow = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'][new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  const mon = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'][m - 1];
  return `${dow} ${d} ${mon} ${y + 543}`;
}

const hhmm = (t: string) => String(t).slice(0, 5);

function row(label: string, value: string, opts: { bold?: boolean; color?: string; size?: string } = {}) {
  return {
    type: 'box', layout: 'horizontal', spacing: 'md',
    contents: [
      { type: 'text', text: label, size: 'sm', color: COLOR.muted, flex: 3 },
      { type: 'text', text: value || '-', size: opts.size ?? 'sm', color: opts.color ?? COLOR.ink, weight: opts.bold ? 'bold' : 'regular', flex: 6, wrap: true },
    ],
  };
}

function button(label: string, uri: string, style: 'primary' | 'secondary' = 'primary', color?: string) {
  return { type: 'button', style, height: 'sm', action: { type: 'uri', label, uri }, ...(color ? { color } : {}) };
}

function card(opts: {
  altText: string; header: string; headerColor: string; sub?: string; body: unknown[]; footer?: unknown[]; note?: string;
}): Flex {
  const footer = [...(opts.footer ?? [])];
  if (opts.note) footer.push({ type: 'text', text: opts.note, size: 'xs', color: COLOR.muted, wrap: true, margin: 'sm' });
  return {
    type: 'flex',
    altText: opts.altText,
    contents: {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box', layout: 'vertical', backgroundColor: opts.headerColor, paddingAll: '14px',
        contents: [
          { type: 'text', text: opts.header, weight: 'bold', size: 'lg', color: '#FFFFFF', wrap: true },
          ...(opts.sub ? [{ type: 'text', text: opts.sub, size: 'sm', color: '#FFFFFFCC', wrap: true }] : []),
        ],
      },
      body: { type: 'box', layout: 'vertical', spacing: 'sm', paddingAll: '14px', contents: opts.body },
      ...(footer.length > 0 ? { footer: { type: 'box', layout: 'vertical', spacing: 'sm', paddingAll: '12px', contents: footer } } : {}),
    },
  };
}

// ───────────────────────────── customer / supplier ─────────────────────────────

export type LinkInput = { docNo: string; partnerName: string | null; direction: BookingDirection; dueDate?: string | null; siteName: string; url: string };

/** Admin sends the self-booking link. */
export function bookingLinkFlex(i: LinkInput): Flex {
  return card({
    altText: `${i.siteName}: จองคิว${dirLabel(i.direction)} ${i.docNo}`,
    header: `จองคิว${dirLabel(i.direction)}`,
    headerColor: dirColor(i.direction),
    sub: i.siteName,
    body: [
      row(i.direction === 'outbound' ? 'เลขที่ SO' : 'เลขที่ PO', i.docNo, { bold: true }),
      row(i.direction === 'outbound' ? 'ลูกค้า' : 'Supplier', i.partnerName ?? '-'),
      ...(i.dueDate ? [row('กำหนดส่ง', thaiDate(i.dueDate))] : []),
    ],
    footer: [button('เลือกวันและเวลา', i.url)],
    note: 'เลือกได้เฉพาะวันและเวลาที่ท่าว่าง เมื่อจองแล้วจะได้รับการแจ้งเตือนทาง LINE นี้',
  });
}

export type BookingInput = {
  siteName: string; queueNo: string; direction: BookingDirection; docNo: string | null; date: string; startTime: string; endTime?: string | null;
  dock: string | null; plate: string; vehicleType: string | null; doNo: string | null; statusUrl: string; driverUrl?: string | null;
  /** SO not paid yet: the queue is held but will not be confirmed until payment. */
  paymentPending?: boolean;
};

function bookingRows(b: BookingInput, opts: { dockBig?: boolean } = {}) {
  return [
    row('เลขคิว', b.queueNo, { bold: true, size: 'xl' }),
    row('วันเวลา', `${thaiDate(b.date)} · ${hhmm(b.startTime)}${b.endTime ? `–${hhmm(b.endTime)}` : ''} น.`, { bold: true }),
    row('ท่า', b.dock ?? 'แจ้งเมื่อมาถึง', { bold: Boolean(opts.dockBig), size: opts.dockBig ? 'xl' : 'sm', color: opts.dockBig ? COLOR.call : COLOR.ink }),
    row('ทะเบียน', b.plate),
    ...(b.vehicleType ? [row('ประเภทรถ', b.vehicleType)] : []),
    ...(b.docNo ? [row(b.direction === 'outbound' ? 'SO' : 'PO', b.docNo)] : []),
    row('เลข DO', b.doNo ?? 'รอยืนยัน', { bold: Boolean(b.doNo) }),
  ];
}

/** Customer submitted through the link and the site requires admin confirmation. */
export function bookingSubmittedFlex(b: BookingInput): Flex {
  return card({
    altText: b.paymentPending ? `รับคำขอจองคิว ${b.queueNo} แล้ว รอชำระเงิน` : `รับคำขอจองคิว ${b.queueNo} แล้ว รอเจ้าหน้าที่ยืนยัน`,
    header: 'รับคำขอจองคิวแล้ว',
    headerColor: COLOR.warn,
    sub: b.paymentPending ? 'รอชำระเงิน — คิวจะยืนยันหลังชำระเงินแล้ว' : 'รอเจ้าหน้าที่ยืนยันและออกเลข DO',
    body: bookingRows(b),
    footer: [button('ดูสถานะ', b.statusUrl, 'secondary')],
    note: b.paymentPending
      ? 'กรุณาชำระเงินและแจ้งฝ่ายขาย เมื่อบันทึกการชำระเงินแล้ว ระบบจะส่งเลข DO และลิงก์สำหรับคนขับให้ทาง LINE นี้'
      : 'เมื่อยืนยันแล้ว ระบบจะส่งเลข DO และลิงก์สำหรับคนขับให้ทาง LINE นี้',
  });
}

/** Confirmed (DO issued). Also the "job card" a customer forwards to the driver. */
export function bookingConfirmedFlex(b: BookingInput): Flex {
  const footer = [button('ดู DO และสถานะ', b.statusUrl)];
  if (b.driverUrl) footer.push(button('ลิงก์สำหรับคนขับ', b.driverUrl, 'secondary'));
  return card({
    altText: `ยืนยันคิว ${b.queueNo} · ${b.doNo ?? ''} · ${thaiDate(b.date)} ${hhmm(b.startTime)}`,
    header: `ยืนยันคิว${dirLabel(b.direction)}แล้ว`,
    headerColor: dirColor(b.direction),
    sub: b.siteName,
    body: bookingRows(b),
    footer,
    note: 'กรุณามาตามเวลานัด แจ้งเลขคิวที่ป้อมยาม ส่งต่อลิงก์คนขับให้ผู้ขับรถเพื่อรับแจ้งเมื่อถึงคิว',
  });
}

/** Driver's job card: same facts, driver-facing buttons. */
export function driverJobFlex(b: BookingInput & { driverUrl: string }): Flex {
  return card({
    altText: `งาน${dirLabel(b.direction)} คิว ${b.queueNo} · ${thaiDate(b.date)} ${hhmm(b.startTime)} · ${b.siteName}`,
    header: `งาน${dirLabel(b.direction)} · ${b.siteName}`,
    headerColor: dirColor(b.direction),
    sub: `คิว ${b.queueNo}`,
    body: bookingRows(b),
    footer: [button('เปิด DO และดูท่า', b.driverUrl)],
    note: 'เปิดลิงก์นี้ใน LINE เพื่อรับแจ้งเตือนเมื่อถึงคิวของคุณ',
  });
}

/** "ถึงคิวแล้ว" — sent to the driver (and the customer) when called to a dock. */
export function bookingCalledFlex(b: BookingInput & { callCount?: number | null }): Flex {
  const again = (b.callCount ?? 1) > 1 ? ` (เรียกครั้งที่ ${b.callCount})` : '';
  return card({
    altText: `ถึงคิว ${b.queueNo} แล้ว เชิญเข้า${b.dock ?? 'ท่า'}${again}`,
    header: `ถึงคิวของคุณแล้ว${again}`,
    headerColor: COLOR.call,
    sub: `เชิญเข้า${b.dock ?? 'ท่า'}`,
    body: bookingRows(b, { dockBig: true }),
    footer: [button('เปิดหน้าคิว', b.driverUrl ?? b.statusUrl, 'secondary')],
    note: 'หากไม่เข้าท่าภายในเวลาที่กำหนด ระบบจะเรียกคิวถัดไป',
  });
}

export function bookingRescheduledFlex(b: BookingInput & { prevDate: string; prevTime: string }): Flex {
  return card({
    altText: `เลื่อนคิว ${b.queueNo} เป็น ${thaiDate(b.date)} ${hhmm(b.startTime)}`,
    header: 'เจ้าหน้าที่เลื่อนคิวของคุณ',
    headerColor: COLOR.warn,
    sub: `เดิม ${thaiDate(b.prevDate)} ${hhmm(b.prevTime)} น.`,
    body: bookingRows(b),
    footer: [button('ดูรายละเอียด', b.statusUrl, 'secondary')],
  });
}

export function bookingCancelledFlex(b: Pick<BookingInput, 'siteName' | 'queueNo' | 'date' | 'startTime' | 'docNo' | 'direction' | 'statusUrl'> & { reason?: string | null; byCustomer?: boolean }): Flex {
  return card({
    altText: `ยกเลิกคิว ${b.queueNo} (${thaiDate(b.date)} ${hhmm(b.startTime)})`,
    header: b.byCustomer ? 'ยกเลิกคิวแล้ว' : 'เจ้าหน้าที่ยกเลิกคิวของคุณ',
    headerColor: COLOR.bad,
    sub: b.siteName,
    body: [
      row('เลขคิว', b.queueNo, { bold: true }),
      row('วันเวลา', `${thaiDate(b.date)} · ${hhmm(b.startTime)} น.`),
      ...(b.docNo ? [row(b.direction === 'outbound' ? 'SO' : 'PO', b.docNo)] : []),
      ...(b.reason ? [row('เหตุผล', b.reason)] : []),
    ],
    footer: [button('จองคิวใหม่', b.statusUrl, 'secondary')],
  });
}

export function noShowFlex(b: Pick<BookingInput, 'siteName' | 'queueNo' | 'date' | 'startTime' | 'statusUrl'>): Flex {
  return card({
    altText: `คิว ${b.queueNo} ถูกปิดเนื่องจากไม่มาตามนัด`,
    header: 'ปิดคิว: ไม่มาตามนัด',
    headerColor: COLOR.bad,
    sub: b.siteName,
    body: [row('เลขคิว', b.queueNo, { bold: true }), row('วันเวลานัด', `${thaiDate(b.date)} · ${hhmm(b.startTime)} น.`)],
    footer: [button('จองคิวใหม่', b.statusUrl, 'secondary')],
    note: 'หากต้องการนัดใหม่ กรุณาจองผ่านลิงก์เดิมหรือติดต่อเจ้าหน้าที่',
  });
}

// ───────────────────────────── warehouse team group ─────────────────────────────

export type StaffEvent =
  | { kind: 'submitted'; queueNo: string; partner: string; docNo: string | null; date: string; time: string; plate: string; vehicle: string | null; pending: boolean }
  | { kind: 'customer_cancelled'; queueNo: string; partner: string; date: string; time: string }
  | { kind: 'arrived'; queueNo: string; plate: string; dock: string | null; by: 'driver' | 'staff' }
  | { kind: 'plate_mismatch'; queueNo: string; booked: string; actual: string }
  | { kind: 'no_show'; queueNo: string; partner: string; date: string; time: string }
  | { kind: 'late'; queueNo: string; partner: string; time: string }
  | { kind: 'auto_called'; queueNo: string; plate: string; dock: string | null }
  | { kind: 'payment_cleared'; docNo: string; partner: string; queues: string[]; status: string };

/** One-line group message; the group is a notification feed, not a chat. */
export function staffGroupText(e: StaffEvent): Text {
  switch (e.kind) {
    case 'submitted':
      return { type: 'text', text: `${e.pending ? '🟠 คิวใหม่รอยืนยัน' : '🟢 คิวใหม่'} ${e.queueNo}\n${e.partner}${e.docNo ? ` · ${e.docNo}` : ''}\n${thaiDate(e.date)} ${hhmm(e.time)} น. · ${e.plate}${e.vehicle ? ` · ${e.vehicle}` : ''}` };
    case 'customer_cancelled':
      return { type: 'text', text: `🔴 ลูกค้ายกเลิกคิว ${e.queueNo}\n${e.partner} · ${thaiDate(e.date)} ${hhmm(e.time)} น.` };
    case 'arrived':
      return { type: 'text', text: `🚚 รถมาถึง ${e.queueNo} · ${e.plate}${e.dock ? ` → ${e.dock}` : ''}${e.by === 'driver' ? ' (คนขับเช็คอินเอง)' : ''}` };
    case 'plate_mismatch':
      return { type: 'text', text: `⚠️ ทะเบียนไม่ตรง ${e.queueNo}\nจอง ${e.booked} · มาจริง ${e.actual}` };
    case 'no_show':
      return { type: 'text', text: `⛔ ปิดคิว ไม่มา ${e.queueNo}\n${e.partner} · ${thaiDate(e.date)} ${hhmm(e.time)} น.` };
    case 'payment_cleared':
      return { type: 'text', text: `💰 ${e.docNo} ${e.status}\n${e.partner}\nคิว ${e.queues.join(', ')} รออนุมัติ` };
    case 'late':
      return { type: 'text', text: `⏰ เลยเวลานัด ${e.queueNo} (${hhmm(e.time)} น.) · ${e.partner}` };
    case 'auto_called':
      return { type: 'text', text: `📣 เรียกอัตโนมัติ ${e.queueNo} · ${e.plate}${e.dock ? ` → ${e.dock}` : ''}` };
  }
}

// ───────────────────────────── webhook replies ─────────────────────────────

export function welcomeText(siteName: string): Text {
  return { type: 'text', text: `ยินดีต้อนรับสู่ระบบคิวรับ-ส่งสินค้า ${siteName}\n\nเมื่อได้รับลิงก์จองคิวหรือลิงก์งานคนขับ ให้เปิดผ่าน LINE นี้ ระบบจะแจ้งเตือนสถานะคิวให้อัตโนมัติ\n\nบัญชีนี้ไม่รับข้อความสอบถาม กรุณาติดต่อเจ้าหน้าที่คลังโดยตรง` };
}

export function helpText(siteName: string): Text {
  return { type: 'text', text: `ระบบคิว ${siteName} ส่งแจ้งเตือนอัตโนมัติเท่านั้น\nต้องการจองคิว ใช้ลิงก์ที่ได้รับจากเจ้าหน้าที่ · ต้องการติดต่อ กรุณาโทรหาคลังโดยตรง` };
}

export const GROUP_REGISTER_COMMAND = 'ลงทะเบียนกลุ่ม';

export function groupJoinedText(): Text {
  return { type: 'text', text: `สวัสดีครับ ระบบคิวเข้ากลุ่มแล้ว\nพิมพ์ "${GROUP_REGISTER_COMMAND}" เพื่อให้กลุ่มนี้รับแจ้งเตือนคิวใหม่ รถมาถึง และการยกเลิก` };
}

export function groupRegisteredText(groupName: string | null): Text {
  return { type: 'text', text: `ลงทะเบียนกลุ่ม${groupName ? ` "${groupName}"` : ''} เป็นกลุ่มแจ้งเตือนของทีมคลังแล้ว ✅` };
}
