import { PAYMENT_METHODS, type PaymentMethod, type PaymentStatus } from '@/types/db';

/**
 * Methods the sandbox can act out. The bank-app methods need a real bank app
 * on the other end, so the demo leaves them out rather than fake a PIN screen.
 */
export const DEMO_PAYMENT_METHODS: readonly PaymentMethod[] = PAYMENT_METHODS.filter((m) => m !== 'bank_deeplink' && m !== 'omise_mobile_banking');

/**
 * Shared, dependency-free helpers for the payment *demonstration*.
 *
 * Nothing here talks to Omise, to a bank, or to the database — the sandbox
 * shows customers what the two payment paths look like without moving money.
 * Production vocabulary (PaymentStatus / PaymentMethod) is reused on purpose so
 * the demo never teaches a state the real product does not have.
 */

/** Payee details shown in the demo. Deliberately obvious placeholders. */
export const DEMO_PAYEE = {
  promptpayDisplayName: 'ร้านตัวอย่าง (Demo)',
  promptpayMasked: 'xxx-xxx-8888',
  bankName: 'ธนาคารตัวอย่าง',
  bankAccountNo: '000-0-00000-0',
  bankAccountName: 'บริษัท ตัวอย่าง จำกัด (Demo)',
} as const;

/** Thai labels per payment method, matching the wording used in the real LIFF. */
export const DEMO_METHOD_LABELS: Record<PaymentMethod, { title: string; hint: string }> = {
  omise_promptpay: {
    title: 'สแกน QR PromptPay',
    hint: 'ระบบยืนยันให้อัตโนมัติทันทีที่โอนสำเร็จ',
  },
  bank_transfer: {
    title: 'โอนเงิน + ส่งสลิป',
    hint: 'ลูกค้าอัปโหลดสลิป แล้วร้านกดอนุมัติเอง',
  },
  bank_deeplink: {
    title: 'จ่ายผ่านแอปธนาคาร',
    hint: 'เด้งเข้าแอปธนาคาร ยอดล็อกไว้ ใส่ PIN แล้วระบบยืนยันอัตโนมัติ',
  },
  omise_mobile_banking: {
    title: 'จ่ายผ่านแอปธนาคาร (Omise)',
    hint: 'เลือกธนาคาร เด้งเข้าแอป ยอดล็อกไว้ ใส่ PIN แล้ว Omise ยืนยันอัตโนมัติ',
  },
};

/** Thai labels per payment status, mirroring `liff-payment-panel.tsx`. */
export const DEMO_PAYMENT_LABELS: Record<PaymentStatus, string> = {
  unpaid: 'ยังไม่ต้องชำระ',
  pending_payment: 'รอชำระเงิน',
  awaiting_verification: 'รอร้านตรวจสอบสลิป',
  paid: 'ชำระแล้ว',
  rejected: 'สลิปไม่ผ่านการตรวจสอบ',
  failed: 'ชำระไม่สำเร็จ',
  refunded: 'คืนเงินแล้ว',
};

/** Reject reasons offered in the demo — same presets as the real inbox. */
export const DEMO_REJECT_PRESETS = ['ยอดเงินไม่ตรง', 'รูปไม่ชัด อ่านไม่ออก', 'ไม่พบรายการโอนเข้าบัญชี'] as const;

/**
 * Format an amount as Thai baht.
 * Same shape as the production panel so the demo and the real screen match.
 */
export function formatTHB(amount: number | null | undefined): string {
  return Number(amount ?? 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Cheap deterministic 32-bit hash — enough to make a stable pseudo-random pattern. */
function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Build a QR-looking block matrix for the demo.
 *
 * Deliberately NOT a scannable QR: the sandbox must never hand anyone a code
 * that a banking app would act on. The three finder squares make it read as a
 * QR at a glance; the rest is deterministic noise derived from `seed`, so the
 * same booking always renders the same pattern instead of flickering on
 * re-render.
 */
export function fakeQrBlocks(seed: string, size = 21): boolean[][] {
  let state = hashSeed(seed) || 1;
  const next = () => {
    // xorshift32 — stable across runs, no Math.random.
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0xffffffff;
  };

  const isFinder = (row: number, col: number) => {
    const inBox = (r0: number, c0: number) =>
      row >= r0 && row < r0 + 7 && col >= c0 && col < c0 + 7;
    if (!inBox(0, 0) && !inBox(0, size - 7) && !inBox(size - 7, 0)) return null;
    const r = row < 7 ? row : row - (size - 7);
    const c = col < 7 ? col : col - (size - 7);
    const ring = Math.max(Math.abs(r - 3), Math.abs(c - 3));
    return ring !== 2;
  };

  return Array.from({ length: size }, (_, row) =>
    Array.from({ length: size }, (_, col) => {
      const finder = isFinder(row, col);
      if (finder !== null) return finder;
      return next() > 0.5;
    }),
  );
}
