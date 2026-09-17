import { createAdminClient } from '@/lib/supabase/admin';
import { deeplinkPaymentFlex, qrPaymentFlex, transferPaymentFlex } from '@/lib/line/messages-payment';
import type { BankCode, PaymentMethod } from '@/types/db';
import { getShopPaymentConfig } from './settings';
import { createBookingQrPayment } from './qr';
import { createBookingTransferPayment } from './transfer';
import { createBookingDeeplinkPayment } from './deeplink';
import { createBookingMobileBankingPayment } from './mobile-banking';
import { isMobileBankingAmountOk, type OmisePlatformType } from './mobile-banking/banks';

export interface PaymentBankInfo {
  payeeName: string | null;
  promptpayMasked: string | null;
  bankName: string | null;
  bankAccountNo: string | null;
  bankAccountName: string | null;
}

export interface PaymentDeeplinkInfo {
  /** Bank app that opens — `scb`/`kbank` for direct bank APIs, any BankCode for Omise Mobile Banking. */
  provider: BankCode;
  provider_name: string;
  /** Bank deeplink or Omise `authorize_uri`. */
  deeplink_url: string;
  return_url: string;
}

export interface PaymentSetupResult {
  method: PaymentMethod;
  amountTHB: number;
  /** Empty string on the bank-app paths — there is nothing to scan. */
  qrImageUrl: string;
  expiresAt: string | null;
  isTest: boolean;
  /** Ready-to-push LINE Flex message for this method. */
  flex: object;
  /** Payee details — only present on the bank-transfer path. */
  bank: PaymentBankInfo | null;
  /** Bank-app link — present on the bank_deeplink and omise_mobile_banking paths. */
  deeplink: PaymentDeeplinkInfo | null;
}

/** Statuses where re-issuing an invoice would destroy state the customer already advanced. */
const LOCKED_STATUSES = new Set(['awaiting_verification', 'paid']);

function liffUrl(shopKey: string | null | undefined) {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/+$/, '');
  if (!base || !shopKey) return null;
  return `${base}/liff/${encodeURIComponent(shopKey)}?tab=account`;
}

/**
 * Decide how a booking gets paid for, set it up, and return everything the
 * caller needs to tell the customer.
 *
 * Both booking routes call this instead of reaching into a specific provider,
 * so the enable/price/idempotency rules live in exactly one place.
 * Returns null when no payment is due or possible — that is not an error.
 */
export async function resolvePaymentForBooking(opts: {
  bookingId: string;
  shopId: string;
  companyId: string;
  shopKey?: string | null;
  amountTHB: number;
  shopName: string;
  queueNumber: string;
  serviceName: string;
  branchName: string;
  dateLabel: string;
  timeLabel: string;
  requestedMethod?: PaymentMethod | null;
  /** Which bank the customer tapped; only meaningful with a bank-app method. */
  requestedBankProvider?: BankCode | null;
  /** Omise platform hint (from the user agent) for mobile banking. */
  platformType?: OmisePlatformType | null;
}): Promise<PaymentSetupResult | null> {
  if (!(opts.amountTHB > 0)) return null;

  const admin = createAdminClient();
  const config = await getShopPaymentConfig(admin, opts.shopId);
  // Omise refuses mobile banking outside its limits — drop it so the booking
  // falls through to the next usable method instead of ending up unpayable.
  const enabledMethods = config.enabledMethods.filter(
    (m) => m !== 'omise_mobile_banking' || isMobileBankingAmountOk(opts.amountTHB),
  );
  if (enabledMethods.length === 0) return null;

  // Never clobber a booking the customer has already paid or submitted a slip for.
  const { data: current } = await admin
    .from('bookings')
    .select('payment_status')
    .eq('id', opts.bookingId)
    .maybeSingle();
  if (current && LOCKED_STATUSES.has(String(current.payment_status))) return null;

  const method: PaymentMethod =
    opts.requestedMethod && enabledMethods.includes(opts.requestedMethod)
      ? opts.requestedMethod
      : enabledMethods[0];

  const common = {
    shopName: opts.shopName,
    queueNumber: opts.queueNumber,
    service: opts.serviceName,
    branch: opts.branchName,
    date: opts.dateLabel,
    time: opts.timeLabel,
  };

  if (method === 'bank_deeplink') {
    // A deeplink needs a public return URL, which needs the shop key.
    if (!opts.shopKey) return null;
    const providerConfig =
      config.deeplinkProviders.find((p) => p.provider === opts.requestedBankProvider) ?? config.deeplinkProviders[0];
    if (!providerConfig) return null;

    const result = await createBookingDeeplinkPayment({
      bookingId: opts.bookingId,
      shopId: opts.shopId,
      companyId: opts.companyId,
      shopKey: opts.shopKey,
      shopName: opts.shopName,
      queueNumber: opts.queueNumber,
      amountTHB: opts.amountTHB,
      providerConfig,
    });
    if (!result) return null;

    return {
      method,
      amountTHB: result.amountTHB,
      qrImageUrl: '',
      expiresAt: result.expiresAt,
      isTest: providerConfig.environment === 'sandbox',
      bank: null,
      deeplink: {
        provider: result.provider,
        provider_name: result.providerName,
        deeplink_url: result.deeplinkUrl,
        return_url: result.returnUrl,
      },
      flex: deeplinkPaymentFlex({
        ...common,
        amountTHB: result.amountTHB,
        bankName: result.providerName,
        deeplinkUrl: result.deeplinkUrl,
        fallbackUrl: result.returnUrl,
        expiresAt: result.expiresAt,
        accountUrl: liffUrl(opts.shopKey),
      }),
    };
  }

  if (method === 'omise_mobile_banking') {
    // Omise needs an https return_uri, which needs the shop key.
    if (!opts.shopKey) return null;
    const bank =
      config.mobileBankingBanks.find((b) => b === opts.requestedBankProvider) ?? config.mobileBankingBanks[0];
    if (!bank) return null;

    const result = await createBookingMobileBankingPayment({
      bookingId: opts.bookingId,
      shopId: opts.shopId,
      companyId: opts.companyId,
      shopKey: opts.shopKey,
      shopName: opts.shopName,
      queueNumber: opts.queueNumber,
      amountTHB: opts.amountTHB,
      bank,
      platformType: opts.platformType ?? null,
      config,
    });
    if (!result) return null;

    return {
      method,
      amountTHB: result.amountTHB,
      qrImageUrl: '',
      expiresAt: result.expiresAt,
      isTest: result.isTest,
      bank: null,
      deeplink: {
        provider: result.bank,
        provider_name: result.bankName,
        deeplink_url: result.authorizeUri,
        return_url: result.returnUrl,
      },
      flex: deeplinkPaymentFlex({
        ...common,
        amountTHB: result.amountTHB,
        bankName: result.bankName,
        deeplinkUrl: result.authorizeUri,
        fallbackUrl: result.returnUrl,
        expiresAt: result.expiresAt,
        accountUrl: liffUrl(opts.shopKey),
      }),
    };
  }

  if (method === 'bank_transfer') {
    const result = await createBookingTransferPayment({
      bookingId: opts.bookingId,
      shopId: opts.shopId,
      companyId: opts.companyId,
      amountTHB: opts.amountTHB,
      config,
    });
    if (!result) return null;

    return {
      method,
      amountTHB: result.amountTHB,
      qrImageUrl: result.qrImageUrl,
      expiresAt: result.expiresAt,
      isTest: false,
      bank: {
        payeeName: result.payeeName,
        promptpayMasked: result.promptpayMasked,
        bankName: result.bankName,
        bankAccountNo: result.bankAccountNo,
        bankAccountName: result.bankAccountName,
      },
      deeplink: null,
      flex: transferPaymentFlex({
        ...common,
        amountTHB: result.amountTHB,
        qrImageUrl: result.qrImageUrl,
        payeeName: result.payeeName,
        promptpayMasked: result.promptpayMasked,
        bankName: result.bankName,
        bankAccountNo: result.bankAccountNo,
        expiresAt: result.expiresAt,
        uploadUrl: liffUrl(opts.shopKey),
      }),
    };
  }

  const result = await createBookingQrPayment({
    bookingId: opts.bookingId,
    shopId: opts.shopId,
    companyId: opts.companyId,
    amountTHB: opts.amountTHB,
    shopName: opts.shopName,
    queueNumber: opts.queueNumber,
    config,
  });
  if (!result) return null;

  return {
    method: 'omise_promptpay',
    amountTHB: result.amountTHB,
    qrImageUrl: result.qrImageUrl,
    expiresAt: result.expiresAt,
    isTest: result.isTest,
    bank: null,
    deeplink: null,
    flex: qrPaymentFlex({
      ...common,
      amountTHB: result.amountTHB,
      qrImageUrl: result.qrImageUrl,
      expiresAt: result.expiresAt,
      isTest: result.isTest,
    }),
  };
}
