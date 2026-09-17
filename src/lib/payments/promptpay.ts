/**
 * PromptPay QR payload generation (EMVCo Merchant Presented QR, BoT profile).
 *
 * Hand-rolled rather than pulling a package: the Bank of Thailand spec has been
 * frozen since 2017, this is a pure function that unit-tests against known-good
 * payload strings, and it keeps the dependency list lean. QR *rasterization* is
 * a different story — that uses the `qrcode` package.
 */

export type PromptPayTargetKind = 'phone' | 'nid' | 'ewallet';

export interface PromptPayTarget {
  kind: PromptPayTargetKind;
  /** Digits only, as stored in shops.promptpay_id. */
  value: string;
}

const AID_PROMPTPAY = 'A000000677010111';

/** Sub-tag under tag 29, chosen by target kind. */
const SUBTAG_BY_KIND: Record<PromptPayTargetKind, string> = {
  phone: '01',
  nid: '02',
  ewallet: '03',
};

/**
 * Parse and normalize a user-entered PromptPay target.
 *
 * Accepts a Thai mobile number (10 digits, optionally +66-prefixed or with
 * separators), a national ID / tax ID (13 digits), or an e-wallet id (15 digits).
 * Returns null when the input is not a valid target — callers must reject rather
 * than store, or the shop ends up with a QR nobody can pay.
 */
export function normalizePromptPayTarget(raw: string): PromptPayTarget | null {
  if (!raw) return null;

  let digits = raw.replace(/\D/g, '');
  // +66 81 234 5678 / 0066... -> 0812345678
  if (digits.length === 11 && digits.startsWith('66')) digits = `0${digits.slice(2)}`;
  else if (digits.length === 13 && digits.startsWith('0066')) digits = `0${digits.slice(4)}`;

  if (/^0\d{9}$/.test(digits)) return { kind: 'phone', value: digits };
  if (/^\d{13}$/.test(digits)) return { kind: 'nid', value: digits };
  if (/^\d{15}$/.test(digits)) return { kind: 'ewallet', value: digits };
  return null;
}

/** Encode a phone number as the 13-digit form the spec requires: 0066 + number without its leading 0. */
function encodePhone(value: string): string {
  return `0066${value.slice(1)}`.padStart(13, '0');
}

/** EMVCo TLV field: 2-digit id + 2-digit length + value. */
function tlv(id: string, value: string): string {
  return `${id}${String(value.length).padStart(2, '0')}${value}`;
}

/**
 * CRC-16/CCITT-FALSE — poly 0x1021, init 0xFFFF, no reflection, no final xor.
 * Computed over the whole payload including the literal '6304' of tag 63.
 */
export function crc16ccitt(input: string): string {
  let crc = 0xffff;
  for (let i = 0; i < input.length; i += 1) {
    crc ^= input.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

/**
 * Build the QR payload string for a PromptPay transfer.
 *
 * Point-of-initiation (tag 01) follows the ecosystem convention every Thai
 * merchant tool emits: '12' (dynamic) when an amount is fixed, '11' (static)
 * when the payer types the amount. Deviating from that on a payment path is not
 * worth the risk of an app rendering the amount differently.
 *
 * @throws if the target cannot be normalized.
 */
export function buildPromptPayPayload(opts: { target: string; amountTHB?: number }): string {
  const target = normalizePromptPayTarget(opts.target);
  if (!target) throw new Error('Invalid PromptPay target');

  const hasAmount = Boolean(opts.amountTHB && opts.amountTHB > 0);
  const encoded = target.kind === 'phone' ? encodePhone(target.value) : target.value;
  const merchantAccount = tlv('00', AID_PROMPTPAY) + tlv(SUBTAG_BY_KIND[target.kind], encoded);

  let payload =
    tlv('00', '01') +
    tlv('01', hasAmount ? '12' : '11') +
    tlv('29', merchantAccount) +
    tlv('53', '764');

  if (hasAmount) {
    payload += tlv('54', (opts.amountTHB as number).toFixed(2));
  }

  payload += tlv('58', 'TH');
  payload += '6304';
  return payload + crc16ccitt(payload);
}

/**
 * Display form of a PromptPay id, safe to send to a customer.
 * Keeps only the last 4 digits — never return the raw id from an API.
 */
export function maskPromptPayId(raw: string): string {
  const target = normalizePromptPayTarget(raw);
  if (!target) return '';
  const last4 = target.value.slice(-4);
  return target.kind === 'phone' ? `xxx-xxx-${last4}` : `${'x'.repeat(target.value.length - 4)}${last4}`;
}
