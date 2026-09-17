import { randomUUID } from 'crypto';
import { z } from 'zod';
import {
  DeeplinkProviderError,
  getCachedToken,
  pickAmount,
  pickString,
  sanitizeRaw,
  setCachedToken,
  type BankDeeplinkAdapter,
  type BankTxnStatus,
  type ConfirmationPayload,
  type CreateDeeplinkInput,
  type CreateDeeplinkResult,
  type DeeplinkProviderConfig,
  type InquiryLookup,
  type InquiryResult,
} from './types';

/**
 * KBank "Pay with K PLUS" deeplink.
 *
 * KBank's partner documentation is gated, so this adapter follows the request
 * envelope KBank's payment APIs share (partnerTxnUid / partnerId /
 * partnerSecret / requestDt / merchantId). EVERY literal is marked VERIFY.
 * The registry keeps this provider hidden from customers until
 * DEEPLINK_KBANK_ENABLED=true is set by someone who has confirmed the fields.
 *
 * Production KBank APIs require mutual TLS with a bank-issued client
 * certificate. That is not wired yet — see the VERIFY checklist in the plan.
 */

// VERIFY: base URLs.
const KBANK_BASE_URL = {
  sandbox: 'https://openapi-sandbox.kasikornbank.com',
  production: 'https://openapi.kasikornbank.com',
} as const;

// VERIFY: paths — product may be exposed as /v1/paywithkplus or /v1/kplus/payment.
const KBANK_PATH = {
  token: '/v2/oauth/token',
  create: '/v1/paywithkplus/request',
  inquiry: '/v1/paywithkplus/inquiry',
} as const;

// VERIFY: KBank reference fields — assumed ≤ 20 chars alphanumeric.
const KBANK_REF_MAX = 20;
const KBANK_REF_PATTERN = /[^A-Za-z0-9]/g;

const KBANK_CREDENTIALS_SCHEMA = z.object({
  consumerId: z.string().trim().min(8),
  consumerSecret: z.string().trim().min(8),
  partnerId: z.string().trim().min(3),
  partnerSecret: z.string().trim().min(3),
});
export type KbankCredentials = z.infer<typeof KBANK_CREDENTIALS_SCHEMA>;

// VERIFY: payment notification body.
const KBANK_CONFIRMATION_SCHEMA = z.object({
  partnerTxnUid: z.string().optional(),
  origPartnerTxnUid: z.string().optional(),
  txnNo: z.union([z.string(), z.number()]).optional(),
  txnAmount: z.union([z.string(), z.number()]).optional(),
  txnStatus: z.string().optional(),
  statusCode: z.string().optional(),
  merchantId: z.string().optional(),
  reference1: z.string().optional(),
  txnDt: z.string().optional(),
  paidDt: z.string().optional(),
  requestDt: z.string().optional(),
}).passthrough();

const SECRET_KEYS = ['consumerSecret', 'partnerSecret', 'access_token', 'accessToken', 'deeplinkUrl', 'deepLinkUrl', 'linkUrl'];

function baseUrl(config: DeeplinkProviderConfig) {
  return KBANK_BASE_URL[config.environment];
}

function credentialsOf(config: DeeplinkProviderConfig): KbankCredentials {
  return KBANK_CREDENTIALS_SCHEMA.parse(config.credentials);
}

export function toKbankRef(value: string): string {
  return value.replace(KBANK_REF_PATTERN, '').slice(0, KBANK_REF_MAX);
}

/** KBank wants local Bangkok time with offset, e.g. 2026-09-10T10:00:00+07:00. VERIFY format. */
export function kbankRequestDt(date = new Date()): string {
  const bangkok = new Date(date.getTime() + 7 * 3600_000);
  return `${bangkok.toISOString().slice(0, 19)}+07:00`;
}

async function readJson(res: Response): Promise<Record<string, unknown>> {
  try {
    const json = (await res.json()) as unknown;
    return json && typeof json === 'object' ? (json as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function sandboxHeaders(config: DeeplinkProviderConfig): Record<string, string> {
  // VERIFY: sandbox routing headers.
  return config.environment === 'sandbox' ? { 'x-test-mode': 'true', 'env-id': 'OAUTH2' } : {};
}

async function fetchToken(config: DeeplinkProviderConfig, cacheKey: string): Promise<string> {
  const cached = getCachedToken(cacheKey);
  if (cached) return cached;

  const creds = credentialsOf(config);
  const basic = Buffer.from(`${creds.consumerId}:${creds.consumerSecret}`).toString('base64');
  const res = await fetch(`${baseUrl(config)}${KBANK_PATH.token}`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      ...sandboxHeaders(config),
    },
    body: new URLSearchParams({ grant_type: 'client_credentials' }),
  });
  const json = await readJson(res);
  const token = pickString(json, ['access_token', 'accessToken']);
  if (!res.ok || !token) {
    throw new DeeplinkProviderError('kbank_auth_failed', 'KBank authorization failed', res.status);
  }
  const expiresIn = pickAmount(json, ['expires_in', 'expiresIn']) ?? 1500;
  setCachedToken(cacheKey, token, expiresIn);
  return token;
}

function apiHeaders(config: DeeplinkProviderConfig, token: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    'x-request-id': randomUUID(),
    ...sandboxHeaders(config),
  };
}

/** Common envelope every KBank payment request carries. VERIFY. */
function envelope(config: DeeplinkProviderConfig, partnerTxnUid: string) {
  const creds = credentialsOf(config);
  return {
    partnerTxnUid,
    partnerId: creds.partnerId,
    partnerSecret: creds.partnerSecret,
    requestDt: kbankRequestDt(),
    merchantId: config.billerId,
  };
}

// VERIFY: txnStatus vocabulary.
function mapStatus(raw: string | null): BankTxnStatus {
  const value = (raw ?? '').toUpperCase();
  if (['PAID', 'SUCCESS', 'COMPLETED'].includes(value)) return 'paid';
  if (['CANCELLED', 'CANCELED', 'FAILED', 'ERROR', 'REJECTED', 'VOIDED'].includes(value)) return 'failed';
  if (['EXPIRED', 'TIMEOUT'].includes(value)) return 'expired';
  return 'pending';
}

function isOk(json: Record<string, unknown>) {
  const code = pickString(json, ['statusCode']);
  return code === null || code === '00';
}

export const kbankAdapter: BankDeeplinkAdapter = {
  provider: 'kbank',
  displayName: 'K PLUS',

  parseCredentials(input: unknown) {
    return KBANK_CREDENTIALS_SCHEMA.parse(input);
  },

  credentialsHint(credentials: unknown) {
    const parsed = KBANK_CREDENTIALS_SCHEMA.safeParse(credentials);
    return parsed.success ? parsed.data.consumerId.slice(-4) : '';
  },

  async authorize(config, cacheKey) {
    await fetchToken(config, cacheKey);
  },

  async createTransaction(config, input: CreateDeeplinkInput): Promise<CreateDeeplinkResult> {
    const token = await fetchToken(config, input.cacheKey);
    const partnerTxnUid = toKbankRef(input.ref1);
    const amount = Math.round(input.amountTHB * 100) / 100;

    // VERIFY: every field below against the Pay with K PLUS request spec.
    const body = {
      ...envelope(config, partnerTxnUid),
      txnAmount: amount,
      txnCurrencyCode: 'THB',
      reference1: partnerTxnUid,
      reference2: toKbankRef(input.ref2),
      reference3: '',
      reference4: '',
      metadata: input.description.slice(0, 100),
      // VERIFY: field carrying the URL the K PLUS app returns the customer to.
      returnUrl: input.returnUrl,
      // VERIFY: whether session length is configurable; unit assumed minutes.
      expiryMinutes: input.sessionMinutes,
    };

    const res = await fetch(`${baseUrl(config)}${KBANK_PATH.create}`, {
      method: 'POST',
      headers: apiHeaders(config, token),
      body: JSON.stringify(body),
    });
    const json = await readJson(res);
    // VERIFY: response field names for the transaction number and deeplink.
    const transactionId = pickString(json, ['txnNo', 'transactionId']);
    const deeplinkUrl = pickString(json, ['deeplinkUrl', 'deepLinkUrl', 'linkUrl', 'paymentUrl']);
    if (!res.ok || !isOk(json) || !transactionId || !deeplinkUrl) {
      throw new DeeplinkProviderError('kbank_create_failed', 'KBank could not create the payment', res.status);
    }

    return {
      transactionId,
      deeplinkUrl,
      expiresAt: new Date(Date.now() + input.sessionMinutes * 60_000).toISOString(),
      raw: sanitizeRaw(json, SECRET_KEYS),
    };
  },

  async inquireTransaction(config, lookup: InquiryLookup, cacheKey: string): Promise<InquiryResult> {
    if (!lookup.ref1) {
      throw new DeeplinkProviderError('kbank_inquiry_missing_ref', 'KBank inquiry needs the partner reference');
    }
    const token = await fetchToken(config, cacheKey);
    const body = {
      // Inquiry gets its own uid; the original request is referenced separately. VERIFY.
      ...envelope(config, toKbankRef(randomUUID().replace(/-/g, '').slice(0, KBANK_REF_MAX))),
      origPartnerTxnUid: toKbankRef(lookup.ref1),
    };
    const res = await fetch(`${baseUrl(config)}${KBANK_PATH.inquiry}`, {
      method: 'POST',
      headers: apiHeaders(config, token),
      body: JSON.stringify(body),
    });
    const json = await readJson(res);
    if (!res.ok || !isOk(json)) {
      throw new DeeplinkProviderError('kbank_inquiry_failed', 'KBank transaction inquiry failed', res.status);
    }

    return {
      transactionId: pickString(json, ['txnNo', 'transactionId']) ?? lookup.transactionId ?? '',
      status: mapStatus(pickString(json, ['txnStatus', 'status'])),
      amountTHB: pickAmount(json, ['txnAmount', 'amount']),
      paidAt: pickString(json, ['paidDt', 'txnDt', 'paymentDt']),
      raw: sanitizeRaw(json, SECRET_KEYS),
    };
  },

  parseConfirmation(body: unknown): ConfirmationPayload | null {
    const parsed = KBANK_CONFIRMATION_SCHEMA.safeParse(body);
    if (!parsed.success) return null;
    const d = parsed.data;
    const ref1 = d.origPartnerTxnUid?.trim() || d.partnerTxnUid?.trim() || d.reference1?.trim() || null;
    const transactionId = pickString(d, ['txnNo']);
    if (!ref1 && !transactionId) return null;
    return {
      transactionId,
      ref1,
      amountTHB: pickAmount(d, ['txnAmount']),
      paidAt: d.paidDt ?? d.txnDt ?? null,
    };
  },

  confirmationResponse() {
    // VERIFY: acknowledgement body KBank expects from the notification URL.
    return { statusCode: '00', statusMessage: 'success' };
  },
};
