import { describe, expect, it } from 'vitest';
import {
  bookingCalledFlex, bookingCancelledFlex, bookingConfirmedFlex, bookingLinkFlex, bookingRescheduledFlex, bookingSubmittedFlex,
  driverJobFlex, noShowFlex, staffGroupText, thaiDate,
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
      noShowFlex(booking),
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
  });
});

describe('thaiDate', () => {
  it('renders a Buddhist-year short date', () => {
    expect(thaiDate('2026-09-21')).toBe('จ. 21 ก.ย. 2569');
    expect(thaiDate('bad')).toBe('bad');
  });
});
