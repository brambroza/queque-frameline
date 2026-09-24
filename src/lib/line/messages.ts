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

/** "กรุณารอสักครู่" — checked in, appointment time passed, dock still busy. Driver only. */
export function bookingWaitingFlex(b: BookingInput): Flex {
  return card({
    altText: `คิว ${b.queueNo} ล่าช้ากว่ากำหนด ${b.dock ?? 'ท่า'}ยังไม่ว่าง กรุณารอสักครู่`,
    header: 'คิวล่าช้ากว่ากำหนด',
    headerColor: COLOR.warn,
    sub: `${b.dock ?? 'ท่า'}ยังไม่ว่าง · กรุณารอในลานจอดสักครู่`,
    body: bookingRows(b),
    footer: [button('เปิดหน้าคิว', b.driverUrl ?? b.statusUrl, 'secondary')],
    note: 'ระบบจะแจ้งทันทีเมื่อถึงคิวของคุณ ขออภัยในความล่าช้า',
  });
}

/**
 * "เลยเวลานัด" — the grace period passed and the truck has not checked in.
 * Sent to the driver (button opens the driver page) and the customer / supplier
 * (button opens the status page).
 */
export function bookingLateFlex(b: BookingInput & { graceMinutes: number; autoNoShow: boolean; who: 'driver' | 'partner' }): Flex {
  const closing = b.autoNoShow && b.graceMinutes > 0;
  return card({
    altText: `คิว ${b.queueNo} เลยเวลานัด ${hhmm(b.startTime)} น. แล้ว${closing ? ` ต้องมาถึงภายใน ${b.graceMinutes} นาที` : ''}`,
    header: 'เลยเวลานัดแล้ว',
    headerColor: COLOR.warn,
    sub: `นัด ${hhmm(b.startTime)} น. · ยังเข้าได้`,
    body: bookingRows(b),
    footer: [button(b.who === 'driver' ? 'เปิดหน้าคิว' : 'ดูสถานะ', b.who === 'driver' ? b.driverUrl ?? b.statusUrl : b.statusUrl, 'secondary')],
    note: closing
      ? `หากไม่มาถึงภายใน ${b.graceMinutes} นาที ระบบจะปิดคิวอัตโนมัติ กรุณาติดต่อคลังหากมาไม่ทัน`
      : 'กรุณารีบมาถึงคลัง หรือติดต่อเจ้าหน้าที่หากต้องการเลื่อนคิว',
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
  /** Customer changed the vehicle / driver from their link; `null` = that part did not change. */
  | { kind: 'vehicle_changed'; queueNo: string; partner: string; date: string; time: string; plate: { from: string; to: string } | null; driver: { from: string; to: string } | null }
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
    case 'vehicle_changed': {
      const lines = [`🔁 ลูกค้าเปลี่ยนรถ/คนขับ ${e.queueNo}`, `${e.partner} · ${thaiDate(e.date)} ${hhmm(e.time)} น.`];
      if (e.plate) lines.push(`ทะเบียน ${e.plate.from} → ${e.plate.to}`);
      if (e.driver) lines.push(`คนขับ ${e.driver.from} → ${e.driver.to}`);
      return { type: 'text', text: lines.join('\n') };
    }
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

// ───────────────────────────── rich menu replies (self-service) ─────────────────────────────

/** Customer-facing label per queue status (mirrors `PUBLIC_STATUS` on the web page). */
export const QUEUE_STATUS_LABEL: Record<string, { label: string; color: string }> = {
  pending: { label: 'รอเจ้าหน้าที่ยืนยัน', color: COLOR.warn },
  confirmed: { label: 'ยืนยันแล้ว', color: COLOR.out },
  late: { label: 'เลยเวลานัด', color: COLOR.warn },
  checked_in: { label: 'มาถึงแล้ว · รอเรียก', color: COLOR.in },
  called: { label: 'เชิญเข้าท่า', color: COLOR.call },
  serving: { label: 'กำลังขึ้น/ลงของ', color: COLOR.out },
  completed: { label: 'เสร็จสิ้น', color: COLOR.muted },
  cancelled: { label: 'ยกเลิกแล้ว', color: COLOR.bad },
  no_show: { label: 'ไม่มาตามนัด', color: COLOR.bad },
};

/** Status chip text for a queue; an unpaid SO in `pending` reads "รอชำระเงิน". */
export function queueStatusLabel(status: string, paymentPending?: boolean): { label: string; color: string } {
  if (paymentPending && status === 'pending') return { label: 'รอชำระเงิน', color: COLOR.warn };
  return QUEUE_STATUS_LABEL[status] ?? { label: status, color: COLOR.muted };
}

/** One queue in the "คิวของฉัน" answer. `url` = LIFF/web page for that queue (null = no link available). */
export type MyQueueItem = {
  queueNo: string; status: string; direction: BookingDirection; date: string; startTime: string; endTime?: string | null;
  dock: string | null; plate: string; doNo: string | null; docNo: string | null; url: string | null;
  /** How this LINE user relates to the queue: booked it (partner) or drives it. */
  role: 'partner' | 'driver';
  paymentPending?: boolean;
};

/** Flex carousel can carry at most 12 bubbles; keep room for the "more" note. */
export const REPLY_LIST_LIMIT = 10;

function statusChip(s: { label: string; color: string }) {
  return {
    type: 'box', layout: 'vertical', backgroundColor: `${s.color}1A`, cornerRadius: 'md', paddingAll: '6px', paddingStart: '10px', paddingEnd: '10px',
    contents: [{ type: 'text', text: s.label, size: 'xs', weight: 'bold', color: s.color, align: 'center' }],
  };
}

function bubble(opts: { header: string; headerColor: string; sub?: string; body: unknown[]; footer?: unknown[] }) {
  return {
    type: 'bubble',
    size: 'kilo',
    header: {
      type: 'box', layout: 'vertical', backgroundColor: opts.headerColor, paddingAll: '12px',
      contents: [
        { type: 'text', text: opts.header, weight: 'bold', size: 'md', color: '#FFFFFF', wrap: true },
        ...(opts.sub ? [{ type: 'text', text: opts.sub, size: 'xs', color: '#FFFFFFCC', wrap: true }] : []),
      ],
    },
    body: { type: 'box', layout: 'vertical', spacing: 'sm', paddingAll: '12px', contents: opts.body },
    ...(opts.footer && opts.footer.length > 0 ? { footer: { type: 'box', layout: 'vertical', spacing: 'sm', paddingAll: '10px', contents: opts.footer } } : {}),
  };
}

function carousel(altText: string, bubbles: unknown[]): Flex {
  return { type: 'flex', altText, contents: { type: 'carousel', contents: bubbles } };
}

/** "คิวของฉัน": one bubble per live queue, today first. Empty list = use `noQueuesText`. */
export function myQueuesFlex(items: MyQueueItem[]): Flex {
  const shown = items.slice(0, REPLY_LIST_LIMIT);
  const bubbles = shown.map((q) => {
    const st = queueStatusLabel(q.status, q.paymentPending);
    return bubble({
      header: `คิว ${q.queueNo}`,
      headerColor: dirColor(q.direction),
      sub: `${dirLabel(q.direction)}${q.role === 'driver' ? ' · คุณเป็นคนขับ' : ''}`,
      body: [
        statusChip(st),
        row('วันเวลา', `${thaiDate(q.date)} · ${hhmm(q.startTime)}${q.endTime ? `–${hhmm(q.endTime)}` : ''} น.`, { bold: true }),
        row('ท่า', q.dock ?? 'แจ้งเมื่อมาถึง', { color: q.status === 'called' ? COLOR.call : COLOR.ink, bold: q.status === 'called' }),
        row('ทะเบียน', q.plate),
        ...(q.docNo ? [row(q.direction === 'outbound' ? 'SO' : 'PO', q.docNo)] : []),
        row('เลข DO', q.doNo ?? 'รอยืนยัน', { bold: Boolean(q.doNo) }),
      ],
      footer: q.url ? [button(q.role === 'driver' ? 'เปิดหน้าคิว' : 'ดูรายละเอียด', q.url, 'secondary')] : [],
    });
  });
  const more = items.length - shown.length;
  const alt = `คิวของคุณ ${shown.map((q) => `${q.queueNo} ${queueStatusLabel(q.status, q.paymentPending).label}`).join(', ')}${more > 0 ? ` และอีก ${more} คิว` : ''}`;
  return carousel(alt.slice(0, 400), bubbles);
}

/** One SO / PO in the "สถานะ SO" answer. */
export type MyDocItem = {
  docNo: string; docType: 'so' | 'po'; partnerName: string | null; status: string; dueDate: string | null; itemCount: number;
  /** SO only: null for PO (no payment gate). */
  paymentStatus: 'unpaid' | 'paid' | 'credit' | null;
  /** Live queues of this document, soonest first. */
  queues: Array<{ queueNo: string; status: string; date: string; startTime: string }>;
  /** Self-booking page (LIFF/web); null = link not available. */
  url: string | null;
};

const DOC_STATUS_LABEL: Record<string, { label: string; color: string }> = {
  open: { label: 'ยังไม่จองคิว', color: COLOR.warn },
  booked: { label: 'จองคิวแล้ว', color: COLOR.out },
  completed: { label: 'รับ-ส่งเสร็จแล้ว', color: COLOR.muted },
  cancelled: { label: 'ยกเลิกเอกสาร', color: COLOR.bad },
};

const PAYMENT_LABEL: Record<string, { label: string; color: string }> = {
  unpaid: { label: 'รอชำระเงิน', color: COLOR.warn },
  paid: { label: 'ชำระแล้ว', color: COLOR.out },
  credit: { label: 'เครดิต', color: COLOR.out },
};

/** "สถานะ SO": one bubble per open document with payment + its queues. Empty list = use `noDocsText`. */
export function myDocsFlex(docs: MyDocItem[]): Flex {
  const shown = docs.slice(0, REPLY_LIST_LIMIT);
  const bubbles = shown.map((d) => {
    const direction: BookingDirection = d.docType === 'so' ? 'outbound' : 'inbound';
    const docStatus = DOC_STATUS_LABEL[d.status] ?? { label: d.status, color: COLOR.muted };
    const pay = d.paymentStatus ? PAYMENT_LABEL[d.paymentStatus] ?? { label: d.paymentStatus, color: COLOR.muted } : null;
    const paymentPending = d.paymentStatus === 'unpaid';
    const queueLines = d.queues.slice(0, 3).map((q) => {
      const st = queueStatusLabel(q.status, paymentPending);
      return {
        type: 'box', layout: 'horizontal', spacing: 'sm',
        contents: [
          { type: 'text', text: q.queueNo, size: 'sm', weight: 'bold', color: COLOR.ink, flex: 2 },
          { type: 'text', text: `${thaiDate(q.date)} ${hhmm(q.startTime)}`, size: 'xs', color: COLOR.muted, flex: 5, wrap: true },
          { type: 'text', text: st.label, size: 'xs', color: st.color, flex: 4, wrap: true, align: 'end' },
        ],
      };
    });
    return bubble({
      header: d.docNo,
      headerColor: dirColor(direction),
      sub: `${d.docType === 'so' ? 'ใบสั่งขาย · รับสินค้า' : 'ใบสั่งซื้อ · ส่งสินค้า'}${d.partnerName ? ` · ${d.partnerName}` : ''}`,
      body: [
        { type: 'box', layout: 'horizontal', spacing: 'sm', contents: [statusChip(docStatus), ...(pay ? [statusChip(pay)] : [])] },
        ...(d.dueDate ? [row('กำหนดส่ง', thaiDate(d.dueDate))] : []),
        row('รายการ', d.itemCount > 0 ? `${d.itemCount} รายการ` : '-'),
        ...(queueLines.length > 0
          ? [{ type: 'separator', margin: 'md', color: COLOR.line }, { type: 'text', text: 'คิว', size: 'xs', color: COLOR.muted, margin: 'md' }, ...queueLines]
          : [{ type: 'text', text: paymentPending ? 'ยังไม่มีคิว · จองได้ แต่จะยืนยันหลังชำระเงิน' : 'ยังไม่มีคิว', size: 'xs', color: COLOR.muted, wrap: true, margin: 'md' }]),
        ...(d.queues.length > 3 ? [{ type: 'text', text: `และอีก ${d.queues.length - 3} คิว`, size: 'xs', color: COLOR.muted }] : []),
      ],
      footer: d.url ? [button(d.status === 'open' ? 'จองคิว' : 'ดูรายละเอียด / จองเพิ่ม', d.url, d.status === 'open' ? 'primary' : 'secondary', d.status === 'open' ? dirColor(direction) : undefined)] : [],
    });
  });
  const more = docs.length - shown.length;
  const alt = `เอกสารของคุณ ${shown.map((d) => `${d.docNo} ${(DOC_STATUS_LABEL[d.status] ?? { label: d.status }).label}`).join(', ')}${more > 0 ? ` และอีก ${more} รายการ` : ''}`;
  return carousel(alt.slice(0, 400), bubbles);
}

/** Text after a carousel when the list was cut at `REPLY_LIST_LIMIT`. */
export function moreItemsText(hidden: number, what: 'คิว' | 'เอกสาร'): Text {
  return { type: 'text', text: `แสดง ${REPLY_LIST_LIMIT} ${what}ล่าสุด ยังมีอีก ${hidden} ${what} — เปิดลิงก์ของแต่ละเอกสารเพื่อดูทั้งหมด` };
}

export function noQueuesText(): Text {
  return { type: 'text', text: 'ยังไม่มีคิวที่กำลังดำเนินการ\nกด "สถานะ SO" เพื่อดูเอกสารที่เปิดอยู่และจองคิว หรือใช้ลิงก์จองที่ได้รับจากเจ้าหน้าที่' };
}

export function noDocsText(): Text {
  return { type: 'text', text: 'ไม่มี SO / PO ที่เปิดอยู่ในตอนนี้\nเมื่อเจ้าหน้าที่ส่งลิงก์จองคิวเอกสารใหม่ให้ เปิดผ่าน LINE นี้แล้วจะเห็นที่เมนูนี้' };
}

/** The LINE user is not attached to any partner / booking yet. */
export function notLinkedText(siteName: string): Text {
  return { type: 'text', text: `ยังไม่พบข้อมูลของคุณในระบบคิว ${siteName}\n\nเปิดลิงก์จองคิว (หรือลิงก์งานคนขับ) ที่ได้รับจากเจ้าหน้าที่ผ่าน LINE นี้ 1 ครั้ง ระบบจะจำบัญชีของคุณ หลังจากนั้นกดเมนูด้านล่างเพื่อดูคิวและสถานะ SO ได้ทันที` };
}

export type ContactInput = { siteName: string; branches: Array<{ name: string; phone: string | null; address: string | null }>; phone: string | null; address: string | null };

/** "ติดต่อคลัง": site / branch phones and addresses. */
export function contactText(c: ContactInput): Text {
  const lines: string[] = [`ติดต่อคลัง ${c.siteName}`];
  const branches = c.branches.filter((b) => b.phone || b.address);
  if (branches.length > 0) {
    for (const b of branches) {
      lines.push('', b.name);
      if (b.phone) lines.push(`โทร ${b.phone}`);
      if (b.address) lines.push(b.address);
    }
  } else {
    if (c.phone) lines.push(`โทร ${c.phone}`);
    if (c.address) lines.push(c.address);
    if (!c.phone && !c.address) lines.push('ยังไม่ได้ระบุเบอร์โทร กรุณาติดต่อฝ่ายขายที่ดูแลคุณ');
  }
  lines.push('', 'เวลาทำการตามที่คลังกำหนด · แจ้งเลขคิวที่ป้อมยามเมื่อมาถึง');
  return { type: 'text', text: lines.join('\n') };
}

// ───────────────────────────── webhook replies ─────────────────────────────

export function welcomeText(siteName: string): Text {
  return { type: 'text', text: `ยินดีต้อนรับสู่ระบบคิวรับ-ส่งสินค้า ${siteName}\n\nเมื่อได้รับลิงก์จองคิวหรือลิงก์งานคนขับ ให้เปิดผ่าน LINE นี้ ระบบจะแจ้งเตือนสถานะคิวให้อัตโนมัติ และกดเมนูด้านล่างเพื่อดูคิวของคุณและสถานะ SO ได้ตลอดเวลา\n\nบัญชีนี้ไม่รับข้อความสอบถาม กรุณาติดต่อเจ้าหน้าที่คลังโดยตรง` };
}

export function helpText(siteName: string): Text {
  return { type: 'text', text: `ระบบคิว ${siteName} ส่งแจ้งเตือนอัตโนมัติเท่านั้น\nกดเมนูด้านล่าง: "คิวของฉัน" ดูคิวที่จองไว้ · "สถานะ SO" ดูเอกสารและการชำระเงิน · "ติดต่อคลัง" ดูเบอร์โทร\nต้องการจองคิว ใช้ลิงก์ที่ได้รับจากเจ้าหน้าที่` };
}

export const GROUP_REGISTER_COMMAND = 'ลงทะเบียนกลุ่ม';

export function groupJoinedText(): Text {
  return { type: 'text', text: `สวัสดีครับ ระบบคิวเข้ากลุ่มแล้ว\nพิมพ์ "${GROUP_REGISTER_COMMAND}" เพื่อให้กลุ่มนี้รับแจ้งเตือนคิวใหม่ รถมาถึง และการยกเลิก` };
}

export function groupRegisteredText(groupName: string | null): Text {
  return { type: 'text', text: `ลงทะเบียนกลุ่ม${groupName ? ` "${groupName}"` : ''} เป็นกลุ่มแจ้งเตือนของทีมคลังแล้ว ✅` };
}
