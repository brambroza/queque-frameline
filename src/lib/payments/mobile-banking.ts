import { createAdminClient } from '@/lib/supabase/admin';
import type { BankCode } from '@/types/db';
import { createMobileBankingCharge } from './omise';
import { buildDeeplinkReturnUrl } from './deeplink';
import { bankDisplayName, isMobileBankingAmountOk, type OmisePlatformType } from './mobile-banking/banks';
import type { ShopPaymentConfig } from './settings';

export interface MobileBankingPaymentResult {
  bank: BankCode;
  bankName: string;
  chargeId: string;
  /** Omise page that hands off to the bank app with the amount locked. Always https. */
  authorizeUri: string;
  returnUrl: string;
  expiresAt: string | null;
  amountTHB: number;
  isTest: boolean;
}

/**
 * Create an Omise Mobile Banking charge for a booking and persist it.
 *
 * Availability (shop toggle, secret key) is decided by the caller via
 * ShopPaymentConfig; this only performs the charge. Each call makes a fresh
 * charge, so re-issuing after expiry or switching bank is safe: the previous
 * charge stays pending on Omise and lapses on its own.
 *
 * Reuses the bank-deeplink columns: `bank_provider` holds the bank and
 * `bank_deeplink_url` holds `authorize_uri`, so the LIFF panel, the return
 * page and the my-queues resume flow treat both bank-app methods alike.
 */
export async function createBookingMobileBankingPayment(opts: {
  bookingId: string;
  shopId: string;
  companyId: string;
  shopKey: string;
  shopName: string;
  queueNumber: string;
  amountTHB: number;
  bank: BankCode;
  platformType?: OmisePlatformType | null;
  config: ShopPaymentConfig;
}): Promise<MobileBankingPaymentResult | null> {
  const secretKey = opts.config.omiseSecretKey;
  if (!secretKey) {
    console.log('[mobile-banking] skipped: no omise secret key');
    return null;
  }

  const amountTHB = opts.amountTHB > 0 ? Math.round(opts.amountTHB * 100) / 100 : 0;
  if (!isMobileBankingAmountOk(amountTHB)) {
    console.log(`[mobile-banking] skipped: amount ${amountTHB} outside Omise limits`);
    return null;
  }
  if (!process.env.PAYMENT_LINK_SECRET) {
    console.error('[mobile-banking] refused: PAYMENT_LINK_SECRET is not set, return page cannot be secured');
    return null;
  }

  const returnUrl = buildDeeplinkReturnUrl(opts.shopKey, opts.bookingId);
  const charge = await createMobileBankingCharge({
    secretKey,
    amountTHB,
    bank: opts.bank,
    returnUri: returnUrl,
    platformType: opts.platformType ?? null,
    description: `${opts.shopName} – ${opts.queueNumber}`,
    metadata: {
      booking_id: opts.bookingId,
      shop_id: opts.shopId,
      queue_number: opts.queueNumber,
      bank: opts.bank,
    },
  });

  const authorizeUri = charge.authorize_uri ?? '';
  if (!authorizeUri) {
    console.error('[mobile-banking] Omise returned no authorize_uri for', charge.id);
    return null;
  }
  const expiresAt = charge.expires_at ?? null;

  const admin = createAdminClient();
  const { error } = await admin
    .from('bookings')
    .update({
      payment_status: 'pending_payment',
      payment_method: 'omise_mobile_banking',
      payment_amount: amountTHB,
      payment_expires_at: expiresAt,
      payment_reject_reason: null,
      omise_charge_id: charge.id,
      omise_qr_image_url: null,
      bank_provider: opts.bank,
      bank_txn_id: null,
      bank_txn_ref: null,
      bank_deeplink_url: authorizeUri,
    })
    .eq('id', opts.bookingId)
    .eq('shop_id', opts.shopId);

  if (error) {
    console.error('[mobile-banking] booking update error:', error.message);
    return null;
  }

  await admin.from('payment_transactions').insert({
    company_id: opts.companyId,
    shop_id: opts.shopId,
    booking_id: opts.bookingId,
    omise_charge_id: charge.id,
    method: 'omise_mobile_banking',
    provider: opts.bank,
    amount: amountTHB,
    currency: 'THB',
    status: 'pending',
    event_type: 'charge.create',
    raw_event: charge as unknown as Record<string, unknown>,
  });

  return {
    bank: opts.bank,
    bankName: bankDisplayName(opts.bank),
    chargeId: charge.id,
    authorizeUri,
    returnUrl,
    expiresAt,
    amountTHB,
    isTest: secretKey.startsWith('skey_test_'),
  };
}
