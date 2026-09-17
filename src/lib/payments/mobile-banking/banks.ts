import { BANK_CODES, type BankCode, type PaymentMethod } from '@/types/db';

/**
 * Static registry of the Thai bank apps Omise Mobile Banking can open.
 *
 * Pure data with no secrets, so LIFF components import it for labels and
 * brand colours. Order is the button order shown to customers.
 */
export interface MobileBank {
  code: BankCode;
  /** App name as customers know it. */
  name: string;
  /** Brand colour for the button background. */
  color: string;
  /** Omise source type. */
  sourceType: `mobile_banking_${BankCode}`;
}

export const MOBILE_BANKS: readonly MobileBank[] = [
  { code: 'kbank', name: 'K PLUS', color: '#138f2d', sourceType: 'mobile_banking_kbank' },
  { code: 'scb', name: 'SCB EASY', color: '#4e2e7f', sourceType: 'mobile_banking_scb' },
  { code: 'bay', name: 'KMA กรุงศรี', color: '#fec43b', sourceType: 'mobile_banking_bay' },
  { code: 'bbl', name: 'Bualuang mBanking', color: '#1e4598', sourceType: 'mobile_banking_bbl' },
  { code: 'ktb', name: 'Krungthai NEXT', color: '#1ba5e1', sourceType: 'mobile_banking_ktb' },
];

/** Omise limits for every mobile banking source (THB). */
export const MOBILE_BANKING_MIN_THB = 20;
export const MOBILE_BANKING_MAX_THB = 150_000;

export type OmisePlatformType = 'IOS' | 'ANDROID';

/** Narrow an unknown value to a BankCode, or null. */
export function parseBankCode(value: unknown): BankCode | null {
  return typeof value === 'string' && (BANK_CODES as readonly string[]).includes(value) ? (value as BankCode) : null;
}

/** Registry entry for a bank code. */
export function mobileBank(code: BankCode): MobileBank {
  const found = MOBILE_BANKS.find((b) => b.code === code);
  if (!found) throw new Error(`Unknown bank code: ${code}`);
  return found;
}

/** Customer-facing app name, e.g. "K PLUS". Falls back to the raw code. */
export function bankDisplayName(code: string | null | undefined): string {
  const parsed = parseBankCode(code);
  return parsed ? mobileBank(parsed).name : (code ?? 'ธนาคาร');
}

/** Brand colour for a bank button. */
export function bankColor(code: BankCode): string {
  return mobileBank(code).color;
}

/** Omise source type for a bank. */
export function sourceTypeFor(code: BankCode): MobileBank['sourceType'] {
  return mobileBank(code).sourceType;
}

/** True when Omise accepts this amount for a mobile banking charge. */
export function isMobileBankingAmountOk(amountTHB: number): boolean {
  return Number.isFinite(amountTHB) && amountTHB >= MOBILE_BANKING_MIN_THB && amountTHB <= MOBILE_BANKING_MAX_THB;
}

/**
 * Omise `platform_type` hint from a user agent, so the bank picks the right
 * app-store fallback. Null on desktop or unknown clients (the param is optional).
 */
export function detectOmisePlatform(userAgent: string | null | undefined): OmisePlatformType | null {
  const ua = userAgent ?? '';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'IOS';
  if (/Android/i.test(ua)) return 'ANDROID';
  return null;
}

/** Methods where the customer pays inside a bank app and we confirm automatically. */
export function isBankAppMethod(method: string | null | undefined): method is Extract<PaymentMethod, 'bank_deeplink' | 'omise_mobile_banking'> {
  return method === 'bank_deeplink' || method === 'omise_mobile_banking';
}
