import { randomBytes } from 'crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import type { BankProvider } from '@/types/db';
import { signBookingToken } from './tokens';
import { getDeeplinkAdapter } from './deeplink/registry';
import { providerCacheKey } from './deeplink/settings';
import type { DeeplinkProviderConfig } from './deeplink/types';

export interface DeeplinkPaymentResult {
  provider: BankProvider;
  providerName: string;
  transactionId: string;
  deeplinkUrl: string;
  expiresAt: string;
  amountTHB: number;
  returnUrl: string;
}

/** Bank reference alphabet: unambiguous upper-case letters and digits (RFC 4648 base32). */
const REF_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const REF_LENGTH = 16;

/** Short bank-safe reference for one payment attempt. */
export function generateBankTxnRef(): string {
  const bytes = randomBytes(REF_LENGTH);
  let out = '';
  for (let i = 0; i < REF_LENGTH; i += 1) out += REF_ALPHABET[bytes[i] % REF_ALPHABET.length];
  return out;
}

/**
 * Page the bank app returns the customer to. It lives outside LIFF (the bank
 * app opens it in the system browser), so it authenticates with the HMAC token.
 */
export function buildDeeplinkReturnUrl(shopKey: string, bookingId: string): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/+$/, '');
  const token = signBookingToken(bookingId);
  return `${base}/liff/${encodeURIComponent(shopKey)}/pay/return?booking_id=${encodeURIComponent(bookingId)}&t=${token}`;
}

/**
 * Ask the bank for a deeplink for this booking and persist the attempt.
 *
 * Availability (shop enabled the bank, deployment allows it) is decided by the
 * caller via ShopPaymentConfig; this only performs the charge. Each call makes
 * a fresh bank transaction with a new reference, so re-issuing after expiry is
 * safe: confirmations for the previous transaction id no longer match.
 */
export async function createBookingDeeplinkPayment(opts: {
  bookingId: string;
  shopId: string;
  companyId: string;
  shopKey: string;
  shopName: string;
  queueNumber: string;
  amountTHB: number;
  providerConfig: DeeplinkProviderConfig;
}): Promise<DeeplinkPaymentResult | null> {
  const amountTHB = opts.amountTHB > 0 ? Math.round(opts.amountTHB * 100) / 100 : 0;
  if (amountTHB <= 0) return null;
  if (!process.env.PAYMENT_LINK_SECRET) {
    console.error('[deeplink] refused: PAYMENT_LINK_SECRET is not set, return page cannot be secured');
    return null;
  }

  const config = opts.providerConfig;
  const adapter = getDeeplinkAdapter(config.provider);
  const ref = generateBankTxnRef();
  const returnUrl = buildDeeplinkReturnUrl(opts.shopKey, opts.bookingId);

  const created = await adapter.createTransaction(config, {
    amountTHB,
    ref1: ref,
    ref2: opts.queueNumber,
    description: `${opts.shopName} ${opts.queueNumber}`.trim(),
    sessionMinutes: config.sessionMinutes,
    returnUrl,
    merchantName: config.merchantName?.trim() || opts.shopName,
    cacheKey: providerCacheKey(config),
  });

  const admin = createAdminClient();
  const { error } = await admin
    .from('bookings')
    .update({
      payment_status: 'pending_payment',
      payment_method: 'bank_deeplink',
      payment_amount: amountTHB,
      payment_expires_at: created.expiresAt,
      payment_reject_reason: null,
      bank_provider: config.provider,
      bank_txn_id: created.transactionId,
      bank_txn_ref: ref,
      bank_deeplink_url: created.deeplinkUrl,
    })
    .eq('id', opts.bookingId)
    .eq('shop_id', opts.shopId);

  if (error) {
    console.error('[deeplink] booking update error:', error.message);
    return null;
  }

  await admin.from('payment_transactions').insert({
    company_id: opts.companyId,
    shop_id: opts.shopId,
    booking_id: opts.bookingId,
    method: 'bank_deeplink',
    provider: config.provider,
    provider_txn_id: created.transactionId,
    amount: amountTHB,
    currency: 'THB',
    status: 'pending',
    event_type: 'deeplink.created',
    // Readable by shop staff — no deeplink URL, no credentials.
    raw_event: { ref: ref, environment: config.environment, expires_at: created.expiresAt, bank: created.raw },
  });

  return {
    provider: config.provider,
    providerName: adapter.displayName,
    transactionId: created.transactionId,
    deeplinkUrl: created.deeplinkUrl,
    expiresAt: created.expiresAt,
    amountTHB,
    returnUrl,
  };
}
