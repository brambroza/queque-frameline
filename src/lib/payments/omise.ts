import type { BankCode } from '@/types/db';
import { sourceTypeFor, type OmisePlatformType } from './mobile-banking/banks';

const OMISE_API = 'https://api.omise.co';

export interface OmiseCharge {
  id: string;
  status: 'pending' | 'successful' | 'failed' | 'expired' | 'reversed';
  amount: number;
  currency: string;
  expires_at: string | null;
  paid_at: string | null;
  /** Redirect-flow charges (mobile banking, …): where the customer authorizes. */
  authorize_uri?: string | null;
  return_uri?: string | null;
  failure_code?: string | null;
  failure_message?: string | null;
  source?: {
    type: string;
    platform_type?: string | null;
    scannable_code?: {
      type: string;
      image?: {
        download_uri: string;
      };
    };
  };
}

function authHeader(secretKey: string) {
  return 'Basic ' + Buffer.from(`${secretKey}:`).toString('base64');
}

function appendMetadata(body: URLSearchParams, description?: string, metadata?: Record<string, string>) {
  if (description) body.set('description', description.slice(0, 255));
  if (metadata) {
    for (const [k, v] of Object.entries(metadata)) {
      body.set(`metadata[${k}]`, v);
    }
  }
}

/** POST /charges with a form-encoded body; throws on any non-2xx with Omise's code. */
export async function createCharge(secretKey: string, body: URLSearchParams): Promise<OmiseCharge> {
  const res = await fetch(`${OMISE_API}/charges`, {
    method: 'POST',
    headers: {
      Authorization: authHeader(secretKey),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  const json = (await res.json()) as OmiseCharge & { object?: string; code?: string; message?: string };
  if (!res.ok) {
    throw new Error(`Omise error ${json.code ?? res.status}: ${json.message ?? 'unknown'}`);
  }
  return json;
}

/** Create a PromptPay QR charge. amount is in THB (not satang). */
export async function createPromptPayCharge(opts: {
  secretKey: string;
  amountTHB: number;
  description?: string;
  metadata?: Record<string, string>;
}): Promise<OmiseCharge> {
  const satang = Math.round(opts.amountTHB * 100);
  const body = new URLSearchParams({
    amount: String(satang),
    currency: 'THB',
    'source[type]': 'promptpay',
  });
  appendMetadata(body, opts.description, opts.metadata);
  return createCharge(opts.secretKey, body);
}

/**
 * Create a Mobile Banking charge. amount is in THB (not satang).
 *
 * Redirect flow: the response carries `authorize_uri`, which opens the bank
 * app with the amount locked; the bank sends the customer back to `returnUri`
 * and Omise fires `charge.complete`.
 */
export async function createMobileBankingCharge(opts: {
  secretKey: string;
  amountTHB: number;
  bank: BankCode;
  /** Must be https — Omise rejects anything else. */
  returnUri: string;
  platformType?: OmisePlatformType | null;
  description?: string;
  metadata?: Record<string, string>;
}): Promise<OmiseCharge> {
  const satang = Math.round(opts.amountTHB * 100);
  const body = new URLSearchParams({
    amount: String(satang),
    currency: 'THB',
    'source[type]': sourceTypeFor(opts.bank),
    return_uri: opts.returnUri,
  });
  if (opts.platformType) body.set('source[platform_type]', opts.platformType);
  appendMetadata(body, opts.description, opts.metadata);
  return createCharge(opts.secretKey, body);
}

/** Retrieve a charge from Omise API (used for webhook verification). */
export async function retrieveCharge(chargeId: string, secretKey: string): Promise<OmiseCharge> {
  const res = await fetch(`${OMISE_API}/charges/${chargeId}`, {
    headers: { Authorization: authHeader(secretKey) },
  });
  const json = (await res.json()) as OmiseCharge & { code?: string; message?: string };
  if (!res.ok) {
    throw new Error(`Omise retrieve error ${json.code ?? res.status}: ${json.message ?? 'unknown'}`);
  }
  return json;
}

/** Resolve which Omise secret key to use: shop-level first, fallback to env. */
export function resolveOmiseSecretKey(shopKey?: string | null): string {
  return shopKey || process.env.OMISE_SECRET_KEY || '';
}

/** Return true if the provided key is a test key. */
export function isTestKey(key: string) {
  return key.startsWith('skey_test_') || key.startsWith('pkey_test_');
}
