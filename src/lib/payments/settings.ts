import type { SupabaseClient } from '@supabase/supabase-js';
import type { BankCode, BankProvider, PaymentMethod } from '@/types/db';
import { resolveOmiseSecretKey } from './omise';
import { maskPromptPayId, normalizePromptPayTarget } from './promptpay';
import { loadShopDeeplinkProviders } from './deeplink/settings';
import { providerDisplayName } from './deeplink/registry';
import { MOBILE_BANKS } from './mobile-banking/banks';
import type { DeeplinkProviderConfig } from './deeplink/types';

/**
 * A shop's resolved payment configuration — the single place that decides which
 * methods are actually usable, so no caller has to re-derive it from raw columns.
 */
export interface ShopPaymentConfig {
  /** Methods this shop can actually charge with, in picker order. */
  enabledMethods: PaymentMethod[];
  // TODO(security): omise_secret_key is stored in plain text on shops. Move it
  // behind src/lib/crypto/secret-box.ts the way bank deeplink credentials are.
  omiseSecretKey: string;
  /** Raw PromptPay target. Server-only — never send this to a client. */
  promptpayId: string | null;
  promptpayDisplayName: string | null;
  bankName: string | null;
  bankAccountNo: string | null;
  bankAccountName: string | null;
  transferWindowMinutes: number;
  /** Banks the customer may pay through in-app, in picker order. Server-only (holds credentials). */
  deeplinkProviders: DeeplinkProviderConfig[];
  /** Bank apps offered through Omise Mobile Banking, in picker order. Empty unless the method is enabled. */
  mobileBankingBanks: BankCode[];
}

export interface PublicDeeplinkBank {
  provider: BankProvider;
  display_name: string;
}

export interface PublicMobileBank {
  code: BankCode;
  name: string;
}

/** Customer-safe subset of the config, suitable for /meta and LIFF responses. */
export interface PublicPaymentInfo {
  methods: PaymentMethod[];
  promptpay_display_name: string | null;
  promptpay_masked: string | null;
  bank_name: string | null;
  bank_account_no: string | null;
  bank_account_name: string | null;
  /** One button per entry when `bank_deeplink` is in `methods`. */
  deeplink_banks: PublicDeeplinkBank[];
  /** One button per entry when `omise_mobile_banking` is in `methods`. */
  mobile_banking_banks: PublicMobileBank[];
}

const SHOP_PAYMENT_COLUMNS =
  'qr_payment_enabled, mobile_banking_enabled, omise_secret_key, transfer_payment_enabled, promptpay_id, promptpay_display_name, bank_name, bank_account_no, bank_account_name, transfer_payment_window_minutes';

/**
 * Load a shop's payment configuration in one round trip per source.
 *
 * A method is only reported as enabled when it is both toggled on AND usable:
 * bank transfer needs a parseable PromptPay id, Omise needs a secret key, bank
 * deeplink needs at least one configured bank plus PAYMENT_LINK_SECRET (the
 * bank-app return page authenticates with that token alone), and Omise Mobile
 * Banking needs the secret key plus that same secret. Anything else would
 * produce a booking stuck at pending_payment with no way to pay.
 */
export async function getShopPaymentConfig(
  admin: SupabaseClient,
  shopId: string,
): Promise<ShopPaymentConfig> {
  const [{ data, error }, deeplinkProviders] = await Promise.all([
    admin.from('shops').select(SHOP_PAYMENT_COLUMNS).eq('id', shopId).maybeSingle(),
    loadShopDeeplinkProviders(admin, shopId),
  ]);

  if (error) console.error('[payments] shop config fetch error:', error.message);

  const shop = (data ?? {}) as Record<string, unknown>;
  const omiseSecretKey = resolveOmiseSecretKey((shop.omise_secret_key as string | null) ?? null);
  const promptpayId = (shop.promptpay_id as string | null) ?? null;
  const linkSecretSet = Boolean(process.env.PAYMENT_LINK_SECRET);

  const enabledMethods: PaymentMethod[] = [];
  if (deeplinkProviders.length > 0 && linkSecretSet) {
    enabledMethods.push('bank_deeplink');
  }
  if (shop.mobile_banking_enabled && omiseSecretKey && linkSecretSet) {
    enabledMethods.push('omise_mobile_banking');
  }
  if (shop.transfer_payment_enabled && promptpayId && normalizePromptPayTarget(promptpayId)) {
    enabledMethods.push('bank_transfer');
  }
  if (shop.qr_payment_enabled && omiseSecretKey) {
    enabledMethods.push('omise_promptpay');
  }

  return {
    enabledMethods,
    omiseSecretKey,
    promptpayId,
    promptpayDisplayName: (shop.promptpay_display_name as string | null) ?? null,
    bankName: (shop.bank_name as string | null) ?? null,
    bankAccountNo: (shop.bank_account_no as string | null) ?? null,
    bankAccountName: (shop.bank_account_name as string | null) ?? null,
    transferWindowMinutes: Number(shop.transfer_payment_window_minutes ?? 1440) || 1440,
    deeplinkProviders: enabledMethods.includes('bank_deeplink') ? deeplinkProviders : [],
    mobileBankingBanks: enabledMethods.includes('omise_mobile_banking') ? MOBILE_BANKS.map((b) => b.code) : [],
  };
}

/** Strip a config down to what a customer may see. */
export function toPublicPaymentInfo(config: ShopPaymentConfig): PublicPaymentInfo {
  const showTransfer = config.enabledMethods.includes('bank_transfer');
  return {
    methods: config.enabledMethods,
    promptpay_display_name: showTransfer ? config.promptpayDisplayName : null,
    promptpay_masked: showTransfer && config.promptpayId ? maskPromptPayId(config.promptpayId) : null,
    bank_name: showTransfer ? config.bankName : null,
    bank_account_no: showTransfer ? config.bankAccountNo : null,
    bank_account_name: showTransfer ? config.bankAccountName : null,
    deeplink_banks: config.deeplinkProviders.map((p) => ({
      provider: p.provider,
      display_name: providerDisplayName(p.provider),
    })),
    mobile_banking_banks: MOBILE_BANKS.filter((b) => config.mobileBankingBanks.includes(b.code)).map((b) => ({ code: b.code, name: b.name })),
  };
}
