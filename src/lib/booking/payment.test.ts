import { describe, expect, it } from 'vitest';
import { isPaymentCleared, isPaymentStatus, parsePaymentStatus, paymentApplies, PAYMENT_LABEL, PAYMENT_STATUSES } from './payment';

describe('paymentApplies', () => {
  it('gates SO only', () => {
    expect(paymentApplies('so')).toBe(true);
    expect(paymentApplies('po')).toBe(false);
    expect(paymentApplies(null)).toBe(false);
    expect(paymentApplies(undefined)).toBe(false);
  });
});

describe('isPaymentCleared', () => {
  it('blocks an unpaid SO', () => {
    expect(isPaymentCleared('so', 'unpaid')).toBe(false);
  });

  it('treats a missing or unknown status on an SO as unpaid', () => {
    expect(isPaymentCleared('so', null)).toBe(false);
    expect(isPaymentCleared('so', undefined)).toBe(false);
    expect(isPaymentCleared('so', 'partial')).toBe(false);
  });

  it('clears paid and credit SOs', () => {
    expect(isPaymentCleared('so', 'paid')).toBe(true);
    expect(isPaymentCleared('so', 'credit')).toBe(true);
  });

  it('never blocks a PO or a queue without a document', () => {
    expect(isPaymentCleared('po', 'unpaid')).toBe(true);
    expect(isPaymentCleared(null, null)).toBe(true);
  });
});

describe('isPaymentStatus', () => {
  it('accepts the three statuses only', () => {
    for (const s of PAYMENT_STATUSES) expect(isPaymentStatus(s)).toBe(true);
    expect(isPaymentStatus('partial')).toBe(false);
    expect(isPaymentStatus(1)).toBe(false);
    expect(isPaymentStatus(null)).toBe(false);
  });

  it('has a Thai label for every status', () => {
    for (const s of PAYMENT_STATUSES) expect(PAYMENT_LABEL[s].length).toBeGreaterThan(0);
  });
});

describe('parsePaymentStatus', () => {
  it('leaves the stored value alone when the cell is empty', () => {
    expect(parsePaymentStatus(undefined)).toBeUndefined();
    expect(parsePaymentStatus(null)).toBeUndefined();
    expect(parsePaymentStatus('   ')).toBeUndefined();
  });

  it('reads English and Thai values, case and space insensitive', () => {
    expect(parsePaymentStatus('paid')).toBe('paid');
    expect(parsePaymentStatus(' PAID ')).toBe('paid');
    expect(parsePaymentStatus('ชำระแล้ว')).toBe('paid');
    expect(parsePaymentStatus('ยังไม่ชำระ')).toBe('unpaid');
    expect(parsePaymentStatus('ค้างชำระ')).toBe('unpaid');
    expect(parsePaymentStatus('เครดิต')).toBe('credit');
    expect(parsePaymentStatus('Credit')).toBe('credit');
  });

  it('returns null for text it does not know', () => {
    expect(parsePaymentStatus('maybe')).toBeNull();
    expect(parsePaymentStatus('50%')).toBeNull();
  });
});
