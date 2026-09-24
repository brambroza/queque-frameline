import { describe, expect, it } from 'vitest';
import {
  bookingCalledFlex, bookingCancelledFlex, bookingConfirmedFlex, bookingLateFlex, bookingLinkFlex, bookingRescheduledFlex, bookingSubmittedFlex, bookingWaitingFlex,
  contactText, driverJobFlex, helpText, moreItemsText, myDocsFlex, myQueuesFlex, noDocsText, noQueuesText, noShowFlex, notLinkedText, paymentWarningFlex, REPLY_LIST_LIMIT, staffGroupText, thaiDate, thaiDateTime,
} from './messages';

const booking = {
  siteName: 'Fameline Warehouse', queueNo: 'R-005', direction: 'outbound' as const, docNo: 'SO-2609-0024', date: '2026-09-21', startTime: '10:30:00', endTime: '11:30:00',
  dock: 'ท่า 3', plate: '708812', vehicleType: 'รถ 10 ล้อ', doNo: 'DO-202609-0006', statusUrl: 'https://x/book/t', driverUrl: 'https://x/driver/d',
};

/** Flex JSON must not carry undefined (LINE rejects it) and every text node needs a string. */
function assertClean(node: unknown, path = 'root'): void {
  if (node === undefined) throw new Error(`undefined at ${path}`);
  if (Array.isArray(node)) node.forEach((n, i) => assertClean(n, `${path}[${i}]`));
  else if (node && typeof node === 'object') {
    const o = node as Record<string, unknown>;
    if (o.type === 'text' && typeof o.text !== 'string') throw new Error(`text node without string at ${path}`);
    if (o.type === 'text' && (o.text as string).length === 0) throw new Error(`empty text at ${path}`);
    Object.entries(o).forEach(([k, v]) => assertClean(v, `${path}.${k}`));
  }
}

describe('flex builders', () => {
  it('build clean Flex messages with alt text', () => {
    const all = [
      bookingLinkFlex({ docNo: 'SO-1', partnerName: 'บจก. เอ', direction: 'outbound', dueDate: '2026-09-25', siteName: 'Fameline', url: 'https://x' }),
      bookingSubmittedFlex({ ...booking, doNo: null }),
      bookingConfirmedFlex(booking),
      driverJobFlex({ ...booking, driverUrl: 'https://x/driver/d' }),
      bookingCalledFlex({ ...booking, callCount: 2 }),
      bookingRescheduledFlex({ ...booking, prevDate: '2026-09-20', prevTime: '09:00' }),
      bookingCancelledFlex({ ...booking, reason: 'รถเสีย', byCustomer: true }),
      bookingCancelledFlex({ ...booking, reason: 'ไม่ชำระเงิน', by: 'system' }),
      bookingSubmittedFlex({ ...booking, doNo: null, paymentPending: true, paymentDueAt: '2026-09-21T03:00:00Z' }),
      paymentWarningFlex({ ...booking, doNo: null, dueAt: '2026-09-21T03:00:00Z' }),
      noShowFlex(booking),
      bookingLateFlex({ ...booking, graceMinutes: 30, autoNoShow: true, who: 'driver' }),
      bookingLateFlex({ ...booking, driverUrl: null, graceMinutes: 30, autoNoShow: false, who: 'partner' }),
      bookingWaitingFlex(booking),
      bookingWaitingFlex({ ...booking, dock: null }),
    ];
    for (const m of all) {
      expect(m.type).toBe('flex');
      expect(m.altText.length).toBeGreaterThan(5);
      expect(m.altText.length).toBeLessThanOrEqual(400);
      assertClean(m.contents);
    }
  });

  it('puts the dock front and centre on a call', () => {
    const m = bookingCalledFlex({ ...booking, callCount: 1 });
    expect(m.altText).toContain('ท่า 3');
    expect(JSON.stringify(m.contents)).toContain('เชิญเข้าท่า 3');
    expect(m.altText).not.toContain('ครั้งที่');
    expect(bookingCalledFlex({ ...booking, callCount: 2 }).altText).toContain('เรียกครั้งที่ 2');
  });

  it('omits the driver button when there is no driver link', () => {
    const json = JSON.stringify(bookingConfirmedFlex({ ...booking, driverUrl: null }));
    expect(json).not.toContain('ลิงก์สำหรับคนขับ');
    expect(JSON.stringify(bookingConfirmedFlex(booking))).toContain('ลิงก์สำหรับคนขับ');
  });

  it('names the payment deadline on an unpaid submit and on the warning', () => {
    expect(JSON.stringify(bookingSubmittedFlex({ ...booking, doNo: null, paymentPending: true }).contents)).not.toContain('ชำระภายใน');
    const submitted = JSON.stringify(bookingSubmittedFlex({ ...booking, doNo: null, paymentPending: true, paymentDueAt: '2026-09-21T03:00:00Z' }).contents);
    expect(submitted).toContain('ชำระภายใน');
    expect(submitted).toContain('จ. 21 ก.ย. 2569 10:00 น.');
    const warn = paymentWarningFlex({ ...booking, doNo: null, dueAt: '2026-09-21T03:00:00Z' });
    expect(warn.altText).toContain('R-005');
    expect(warn.altText).toContain('10:00');
    expect(JSON.stringify(warn.contents)).toContain('SO-2609-0024');
  });

  it('tells the customer when the system, not staff, cancelled the queue', () => {
    expect(bookingCancelledFlex({ ...booking, by: 'system' }).altText).toContain('อัตโนมัติ');
    expect(JSON.stringify(bookingCancelledFlex({ ...booking, by: 'system' }).contents)).toContain('ยกเลิกคิวอัตโนมัติ');
    expect(JSON.stringify(bookingCancelledFlex({ ...booking, byCustomer: true }).contents)).toContain('ยกเลิกคิวแล้ว');
    expect(JSON.stringify(bookingCancelledFlex({ ...booking }).contents)).toContain('เจ้าหน้าที่ยกเลิกคิวของคุณ');
  });

  it('uses inbound wording for PO', () => {
    const m = bookingLinkFlex({ docNo: 'PO-9', partnerName: 'หจก. ซี', direction: 'inbound', siteName: 'Fameline', url: 'https://x' });
    expect(m.altText).toContain('ส่งสินค้า');
    expect(JSON.stringify(m.contents)).toContain('เลขที่ PO');
  });
});

describe('staff group text', () => {
  it('is one short message per event', () => {
    const t = staffGroupText({ kind: 'submitted', queueNo: 'R-005', partner: 'บจก. เอ', docNo: 'SO-1', date: '2026-09-21', time: '10:30:00', plate: '708812', vehicle: 'รถ 10 ล้อ', pending: true });
    expect(t.text).toContain('รอยืนยัน');
    expect(t.text).toContain('10:30');
    expect(t.text.length).toBeLessThan(200);
    expect(staffGroupText({ kind: 'payment_cleared', docNo: 'SO-9', partner: 'บจก. เอ', queues: ['R-001', 'R-002'], status: 'ชำระแล้ว' }).text).toContain('R-001, R-002 รออนุมัติ');
    expect(staffGroupText({ kind: 'plate_mismatch', queueNo: 'R-1', booked: 'A', actual: 'B' }).text).toContain('มาจริง B');
    expect(staffGroupText({ kind: 'arrived', queueNo: 'R-1', plate: 'X', dock: null, by: 'driver' }).text).toContain('คนขับเช็คอินเอง');
    expect(staffGroupText({ kind: 'unpaid_cancelled', queueNo: 'R-7', partner: 'บจก. เอ', docNo: 'SO-9', date: '2026-09-21', time: '10:30:00' }).text).toContain('ยกเลิกอัตโนมัติ ไม่ชำระเงิน R-7');
  });

  it('lists only the parts the customer changed', () => {
    const base = { kind: 'vehicle_changed' as const, queueNo: 'R-3', partner: 'บจก. บี', date: '2026-09-25', time: '09:00:00' };
    const plateOnly = staffGroupText({ ...base, plate: { from: '701234', to: '715555' }, driver: null }).text;
    expect(plateOnly).toContain('ทะเบียน 701234 → 715555');
    expect(plateOnly.split('\n')).toHaveLength(3);
    expect(plateOnly.split('\n').filter((l) => l.startsWith('คนขับ'))).toHaveLength(0);
    const both = staffGroupText({ ...base, plate: { from: 'A', to: 'B' }, driver: { from: '-', to: 'ก้อง · 0811111111' } }).text;
    expect(both).toContain('คนขับ - → ก้อง · 0811111111');
    expect(both).toContain('09:00');
  });
});

describe('thaiDate', () => {
  it('renders a Buddhist-year short date', () => {
    expect(thaiDate('2026-09-21')).toBe('จ. 21 ก.ย. 2569');
    expect(thaiDate('bad')).toBe('bad');
  });
  it('renders an instant in Bangkok time', () => {
    expect(thaiDateTime('2026-09-21T03:05:00Z')).toBe('จ. 21 ก.ย. 2569 10:05');
    expect(thaiDateTime('2026-09-21T17:30:00Z')).toBe('อ. 22 ก.ย. 2569 00:30');
    expect(thaiDateTime('bad')).toBe('bad');
  });
});

describe('rich menu replies', () => {
  const queue = {
    queueNo: 'R-012', status: 'confirmed', direction: 'outbound' as const, date: '2026-09-25', startTime: '09:30:00', endTime: '10:30:00',
    dock: 'ท่า 2', plate: '1กข1234', doNo: 'DO-202609-0010', docNo: 'SO-2609-0031', url: 'https://x/book/t', role: 'partner' as const,
  };
  const doc = {
    docNo: 'SO-2609-0031', docType: 'so' as const, partnerName: 'บจก. เอ', status: 'booked', dueDate: '2026-09-26', itemCount: 4, paymentStatus: 'paid' as const,
    queues: [{ queueNo: 'R-012', status: 'confirmed', date: '2026-09-25', startTime: '09:30:00' }], url: 'https://x/book/t',
  };

  it('answers "คิวของฉัน" with one clean bubble per queue, capped with a "more" note', () => {
    const m = myQueuesFlex([queue, { ...queue, queueNo: 'S-003', direction: 'inbound', role: 'driver', url: 'https://x/driver/d', status: 'called' }]);
    expect(m.type).toBe('flex');
    assertClean(m.contents);
    const c = m.contents as { type: string; contents: unknown[] };
    expect(c.type).toBe('carousel');
    expect(c.contents).toHaveLength(2);
    const json = JSON.stringify(m.contents);
    expect(json).toContain('คุณเป็นคนขับ');
    expect(json).toContain('เปิดหน้าคิว');
    expect(json).toContain('เชิญเข้าท่า');
    expect(m.altText).toContain('R-012 ยืนยันแล้ว');

    const many = myQueuesFlex(Array.from({ length: 14 }, (_, i) => ({ ...queue, queueNo: `R-${i}` })));
    expect((many.contents as { contents: unknown[] }).contents).toHaveLength(REPLY_LIST_LIMIT);
    expect(many.altText).toContain('และอีก 4 คิว');
    expect(many.altText.length).toBeLessThanOrEqual(400);
    expect(moreItemsText(4, 'คิว').text).toContain('อีก 4 คิว');
  });

  it('shows "รอชำระเงิน" for a pending queue on an unpaid SO and drops the button without a link', () => {
    const json = JSON.stringify(myQueuesFlex([{ ...queue, status: 'pending', paymentPending: true, url: null }]).contents);
    expect(json).toContain('รอชำระเงิน');
    expect(json).not.toContain('รอเจ้าหน้าที่ยืนยัน');
    expect(json).not.toContain('"type":"button"');
  });

  it('answers "สถานะ SO" with document, payment and queue rows', () => {
    const m = myDocsFlex([doc, { ...doc, docNo: 'PO-77', docType: 'po', status: 'open', paymentStatus: null, queues: [] }, { ...doc, docNo: 'SO-UNPAID', status: 'open', paymentStatus: 'unpaid', queues: [] }]);
    assertClean(m.contents);
    const json = JSON.stringify(m.contents);
    expect(json).toContain('จองคิวแล้ว');
    expect(json).toContain('ชำระแล้ว');
    expect(json).toContain('4 รายการ');
    expect(json).toContain('ใบสั่งซื้อ · ส่งสินค้า');
    expect(json).toContain('ยืนยันหลังชำระเงิน');
    expect(json).toContain('"label":"จองคิว"');
    expect(m.altText).toContain('SO-2609-0031 จองคิวแล้ว');
    expect(m.altText).toContain('PO-77 ยังไม่จองคิว');
  });

  it('writes contact details per branch, falling back to the site', () => {
    const t = contactText({ siteName: 'Fameline', phone: '02-000-0000', address: 'กทม.', branches: [{ name: 'คลังบางนา', phone: '02-111-1111', address: 'บางนา' }, { name: 'ว่าง', phone: null, address: null }] });
    expect(t.text).toContain('คลังบางนา');
    expect(t.text).toContain('โทร 02-111-1111');
    expect(t.text).not.toContain('02-000-0000');
    expect(t.text).not.toContain('ว่าง');
    expect(contactText({ siteName: 'Fameline', phone: '02-000-0000', address: null, branches: [] }).text).toContain('โทร 02-000-0000');
    expect(contactText({ siteName: 'Fameline', phone: null, address: null, branches: [] }).text).toContain('ยังไม่ได้ระบุเบอร์โทร');
  });

  it('has plain-text fallbacks that mention the menu', () => {
    expect(notLinkedText('Fameline').text).toContain('เปิดลิงก์จองคิว');
    expect(noQueuesText().text).toContain('สถานะ SO');
    expect(noDocsText().text.length).toBeGreaterThan(10);
    expect(helpText('Fameline').text).toContain('คิวของฉัน');
  });
});
