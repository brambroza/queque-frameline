import type { SupabaseClient } from '@supabase/supabase-js';
import { BANK_PROVIDERS, type BankProvider } from '@/types/db';
import { paymentSecretBox } from '@/lib/crypto/secret-box';
import { getDeeplinkAdapter, isProviderAvailable, parseBankProvider } from './registry';
import type { DeeplinkEnvironment, DeeplinkProviderConfig } from './types';

const PROVIDER_COLUMNS =
  'id, provider, enabled, environment, biller_id, merchant_name, credentials_enc, webhook_secret, session_minutes';

interface ProviderRow {
  id: string;
  provider: string;
  enabled: boolean;
  environment: string;
  biller_id: string | null;
  merchant_name: string | null;
  credentials_enc: string | null;
  webhook_secret: string;
  session_minutes: number | null;
}

/**
 * Turn a stored row into a usable config, or null when it cannot charge:
 * disabled, bank switched off at deployment level, missing biller/credentials,
 * or credentials that no longer decrypt (rotated key).
 */
function toConfig(row: ProviderRow, opts: { includeDisabled: boolean }): DeeplinkProviderConfig | null {
  const provider = parseBankProvider(row.provider);
  if (!provider) return null;
  if (!opts.includeDisabled && (!row.enabled || !isProviderAvailable(provider))) return null;
  if (!row.biller_id || !row.credentials_enc) return null;

  let credentials: unknown;
  try {
    credentials = getDeeplinkAdapter(provider).parseCredentials(JSON.parse(paymentSecretBox().open(row.credentials_enc)));
  } catch {
    // Never log the row — it would carry the ciphertext next to the failure reason.
    console.error(`[deeplink] credentials for provider ${provider} (row ${row.id}) are unreadable`);
    return null;
  }

  const environment: DeeplinkEnvironment = row.environment === 'production' ? 'production' : 'sandbox';
  const sessionMinutes = Number(row.session_minutes ?? 15);

  return {
    id: row.id,
    provider,
    environment,
    billerId: row.biller_id,
    merchantName: row.merchant_name,
    sessionMinutes: Number.isFinite(sessionMinutes) && sessionMinutes >= 5 ? sessionMinutes : 15,
    webhookSecret: row.webhook_secret,
    credentials,
  };
}

/** Providers a shop can offer to customers right now, in picker order. */
export async function loadShopDeeplinkProviders(admin: SupabaseClient, shopId: string): Promise<DeeplinkProviderConfig[]> {
  const { data, error } = await admin
    .from('shop_bank_deeplink_providers')
    .select(PROVIDER_COLUMNS)
    .eq('shop_id', shopId)
    .eq('is_deleted', false);

  if (error) {
    // Missing table (migration not applied yet) must not break booking.
    console.error('[deeplink] provider fetch error:', error.message);
    return [];
  }

  const order = (p: BankProvider) => (BANK_PROVIDERS as readonly string[]).indexOf(p);
  return ((data ?? []) as ProviderRow[])
    .map((row) => toConfig(row, { includeDisabled: false }))
    .filter((cfg): cfg is DeeplinkProviderConfig => cfg !== null)
    .sort((a, b) => order(a.provider) - order(b.provider));
}

/**
 * One provider's config. `includeDisabled` is for confirmation paths: a shop
 * may switch a bank off while a customer is still paying, and that payment
 * must still be verifiable.
 */
export async function loadShopDeeplinkProvider(
  admin: SupabaseClient,
  shopId: string,
  provider: BankProvider,
  opts: { includeDisabled?: boolean } = {},
): Promise<DeeplinkProviderConfig | null> {
  const { data, error } = await admin
    .from('shop_bank_deeplink_providers')
    .select(PROVIDER_COLUMNS)
    .eq('shop_id', shopId)
    .eq('provider', provider)
    .eq('is_deleted', false)
    .maybeSingle();

  if (error || !data) return null;
  return toConfig(data as ProviderRow, { includeDisabled: opts.includeDisabled ?? false });
}

/** Cache key for bearer tokens — never shared between shops or environments. */
export function providerCacheKey(config: DeeplinkProviderConfig): string {
  return `${config.provider}:${config.id}:${config.environment}`;
}

/** URL the shop owner registers at the bank as the payment confirmation/notification endpoint. */
export function buildDeeplinkWebhookUrl(provider: BankProvider, shopKey: string, webhookSecret: string): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/+$/, '');
  return `${base}/api/payments/bank/${provider}/webhook/${encodeURIComponent(shopKey)}?key=${encodeURIComponent(webhookSecret)}`;
}
