/**
 * Payment gate for Sales Orders. A customer may book a queue against an unpaid
 * SO, but nobody can confirm it (no DO) until the warehouse / admin records the
 * payment. Purchase Orders (supplier deliveries) are never gated. The same rule
 * is enforced in SQL (`document_payment_ok`, trigger `bookings_payment_gate`).
 */

export const PAYMENT_STATUSES = ['unpaid', 'paid', 'credit'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_LABEL: Record<PaymentStatus, string> = {
  unpaid: 'ยังไม่ชำระ',
  paid: 'ชำระแล้ว',
  credit: 'เครดิต',
};

/** MUI chip colour per status. */
export const PAYMENT_COLOR: Record<PaymentStatus, 'error' | 'success' | 'info'> = {
  unpaid: 'error',
  paid: 'success',
  credit: 'info',
};

export const PAYMENT_BLOCK_MESSAGE = 'SO นี้ยังไม่ชำระเงิน — บันทึกการชำระเงินก่อนจึงอนุมัติคิวได้';

export const CUSTOMER_PAYMENT_NOTICE = 'รอชำระเงิน — คิวจะได้รับการยืนยันและออกใบรับสินค้า (DO) หลังชำระเงินแล้ว กรุณาติดต่อฝ่ายขาย';

/** Narrow an unknown value to a payment status. */
export function isPaymentStatus(v: unknown): v is PaymentStatus {
  return typeof v === 'string' && (PAYMENT_STATUSES as readonly string[]).includes(v);
}

/** Only SOs carry a payment requirement. */
export function paymentApplies(docType: string | null | undefined): boolean {
  return docType === 'so';
}

/**
 * Whether a queue tied to this document may be confirmed.
 *
 * @param docType `so` | `po`, or null when the queue has no document.
 * @param status The document's payment_status (anything unknown counts as unpaid).
 */
export function isPaymentCleared(docType: string | null | undefined, status: string | null | undefined): boolean {
  if (!paymentApplies(docType)) return true;
  return status === 'paid' || status === 'credit';
}

const THAI_ALIASES: Record<string, PaymentStatus> = {
  'ชำระแล้ว': 'paid', 'จ่ายแล้ว': 'paid', 'ชำระเงินแล้ว': 'paid', paid: 'paid', y: 'paid', yes: 'paid',
  'ยังไม่ชำระ': 'unpaid', 'ยังไม่จ่าย': 'unpaid', 'ค้างชำระ': 'unpaid', unpaid: 'unpaid', n: 'unpaid', no: 'unpaid',
  'เครดิต': 'credit', credit: 'credit',
};

/** Parse a CSV / ERP cell. Empty → undefined (leave the stored value alone); unknown text → null (a row error). */
export function parsePaymentStatus(raw: unknown): PaymentStatus | undefined | null {
  if (raw === undefined || raw === null) return undefined;
  const key = String(raw).trim().toLowerCase();
  if (!key) return undefined;
  return THAI_ALIASES[key] ?? null;
}
