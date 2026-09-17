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
 * SCB Easy "Deeplink Payment" (Bill Payment sub-type).
 *
 * This is the ONLY file that knows SCB field names. Every literal below was
 * written from memory of the SCB Developer Portal and is marked VERIFY — check
 * each against the portal docs before enabling a production shop.
 *
 * Flow: OAuth client-credentials → create deeplink transaction → customer pays
 * inside SCB Easy → SCB calls our confirmation URL → we re-inquire the
 * transaction before marking the booking paid.
 */

// VERIFY: base URLs.
const SCB_BASE_URL = {
  sandbox: 'https://api-sandbox.partners.scb/partners/sandbox',
  production: 'https://api.partners.scb/partners',
} as const;

// VERIFY: paths.
const SCB_PATH = {
  token: '/v1/oauth/token',
  createDeeplink: '/v3/deeplink/transactions',
  inquiry: (transactionId: string) => `/v2/transactions/${encodeURIComponent(transactionId)}`,
} as const;

// VERIFY: SCB limits ref1/ref2/ref3 to alphanumerics; length limit assumed 20.
const SCB_REF_MAX = 20;
const SCB_REF_PATTERN = /[^A-Z0-9]/g;

const SCB_CREDENTIALS_SCHEMA = z.object({
  applicationKey: z.string().trim().min(8),
  applicationSecret: z.string().trim().min(8),
});
export type ScbCredentials = z.infer<typeof SCB_CREDENTIALS_SCHEMA>;

// VERIFY: confirmation payload field names.
const SCB_CONFIRMATION_SCHEMA = z.object({
  transactionId: z.union([z.string(), z.number()]).optional(),
  amount: z.union([z.string(), z.number()]).optional(),
  billPaymentRef1: z.string().optional(),
  billPaymentRef2: z.string().optional(),
  billPaymentRef3: z.string().optional(),
  payeeProxyId: z.string().optional(),
  payeeProxyType: z.string().optional(),
  payeeAccountNumber: z.string().optional(),
  payerAccountNumber: z.string().optional(),
  payerName: z.string().optional(),
  sendingBankCode: z.string().optional(),
  receivingBankCode: z.string().optional(),
  transactionDateandTime: z.string().optional(),
  transactionDateTime: z.string().optional(),
  currencyCode: z.string().optional(),
}).passthrough();

const SECRET_KEYS = ['applicationSecret', 'accessToken', 'deeplinkUrl', 'authorization'];

function baseUrl(config: DeeplinkProviderConfig) {
  return SCB_BASE_URL[config.environment];
}

function credentialsOf(config: DeeplinkProviderConfig): ScbCredentials {
  return SCB_CREDENTIALS_SCHEMA.parse(config.credentials);
}

/** Normalise a reference to the charset SCB accepts. */
export function toScbRef(value: string): string {
  return value.toUpperCase().replace(SCB_REF_PATTERN, '').slice(0, SCB_REF_MAX);
}

async function readJson(res: Response): Promise<Record<string, unknown>> {
  try {
    const json = (await res.json()) as unknown;
    return json && typeof json === 'object' ? (json as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** SCB wraps payloads as `{ status: { code, description }, data: {...} }`. VERIFY. */
function unwrapData(json: Record<string, unknown>): Record<string, unknown> {
  const data = json.data;
  return data && typeof data === 'object' ? (data as Record<string, unknown>) : json;
}

function statusCodeOf(json: Record<string, unknown>): number | null {
  const status = json.status;
  if (status && typeof status === 'object') {
    const code = (status as Record<string, unknown>).code;
    if (typeof code === 'number') return code;
    if (typeof code === 'string' && code.trim()) return Number(code);
  }
  return null;
}

async function fetchToken(config: DeeplinkProviderConfig, cacheKey: string): Promise<string> {
  const cached = getCachedToken(cacheKey);
  if (cached) return cached;

  const creds = credentialsOf(config);
  const res = await fetch(`${baseUrl(config)}${SCB_PATH.token}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'accept-language': 'EN',
      // VERIFY: SCB requires the application key as resourceOwnerId and a unique requestUId per call.
      resourceOwnerId: creds.applicationKey,
      requestUId: randomUUID(),
    },
    body: JSON.stringify({ applicationKey: creds.applicationKey, applicationSecret: creds.applicationSecret }),
  });
  const json = await readJson(res);
  const data = unwrapData(json);
  // VERIFY: token field names.
  const token = pickString(data, ['accessToken', 'access_token']);
  if (!res.ok || !token) {
    throw new DeeplinkProviderError('scb_auth_failed', 'SCB authorization failed', res.status);
  }
  const expiresIn = pickAmount(data, ['expiresIn', 'expires_in']) ?? 1500;
  setCachedToken(cacheKey, token, expiresIn);
  return token;
}

function authHeaders(config: DeeplinkProviderConfig, token: string) {
  const creds = credentialsOf(config);
  return {
    'Content-Type': 'application/json',
    'accept-language': 'EN',
    authorization: `Bearer ${token}`,
    resourceOwnerId: creds.applicationKey,
    requestUId: randomUUID(),
    // VERIFY: whether the `channel` header is required for deeplink calls.
    channel: 'scbeasy',
  };
}

// VERIFY: status vocabulary returned by the inquiry endpoint.
function mapStatus(data: Record<string, unknown>): BankTxnStatus {
  const raw = (pickString(data, ['transactionStatus', 'statusCode', 'status', 'paymentStatus']) ?? '').toUpperCase();
  if (['SUCCESS', 'SUCCESSFUL', 'PAID', 'COMPLETED', 'COMPLETE'].includes(raw)) return 'paid';
  if (['FAIL', 'FAILED', 'CANCELLED', 'CANCELED', 'REJECTED', 'DECLINED'].includes(raw)) return 'failed';
  if (['EXPIRED', 'TIMEOUT', 'TIMED_OUT'].includes(raw)) return 'expired';
  return 'pending';
}

export const scbAdapter: BankDeeplinkAdapter = {
  provider: 'scb',
  displayName: 'SCB Easy',

  parseCredentials(input: unknown) {
    return SCB_CREDENTIALS_SCHEMA.parse(input);
  },

  credentialsHint(credentials: unknown) {
    const parsed = SCB_CREDENTIALS_SCHEMA.safeParse(credentials);
    return parsed.success ? parsed.data.applicationKey.slice(-4) : '';
  },

  async authorize(config, cacheKey) {
    await fetchToken(config, cacheKey);
  },

  async createTransaction(config, input: CreateDeeplinkInput): Promise<CreateDeeplinkResult> {
    const token = await fetchToken(config, input.cacheKey);
    const ref1 = toScbRef(input.ref1);
    const ref2 = toScbRef(input.ref2) || ref1;
    const amount = Math.round(input.amountTHB * 100) / 100;

    // VERIFY: every field below against "Deeplink Payment › Create transaction".
    const body = {
      transactionType: 'PURCHASE',
      transactionSubType: ['BP'],
      // VERIFY: unit — assumed seconds.
      sessionValidityPeriod: input.sessionMinutes * 60,
      billPayment: {
        // VERIFY: number vs "100.00" string.
        paymentAmount: amount,
        accountTo: config.billerId,
        ref1,
        ref2,
        // VERIFY: whether ref3 needs an SCB-assigned prefix.
        ref3: toScbRef(ref1.slice(0, 3)),
      },
      merchantMetaData: {
        // VERIFY: callbackUrl is where SCB Easy sends the customer back (not the confirmation webhook).
        callbackUrl: input.returnUrl,
        merchantInfo: { name: input.merchantName.slice(0, 40) },
        extraData: {},
        paymentInfo: [
          { type: 'TEXT_WITH_IMAGE', title: input.description.slice(0, 60), header: '', description: '', imageUrl: '' },
        ],
      },
    };

    const res = await fetch(`${baseUrl(config)}${SCB_PATH.createDeeplink}`, {
      method: 'POST',
      headers: authHeaders(config, token),
      body: JSON.stringify(body),
    });
    const json = await readJson(res);
    const data = unwrapData(json);
    // VERIFY: response field names.
    const transactionId = pickString(data, ['transactionId', 'transactionID']);
    const deeplinkUrl = pickString(data, ['deeplinkUrl', 'deepLinkUrl']);
    const code = statusCodeOf(json);
    if (!res.ok || !transactionId || !deeplinkUrl || (code !== null && code !== 1000)) {
      throw new DeeplinkProviderError('scb_create_failed', 'SCB could not create the payment', res.status);
    }

    return {
      transactionId,
      deeplinkUrl,
      expiresAt: new Date(Date.now() + input.sessionMinutes * 60_000).toISOString(),
      raw: sanitizeRaw(data, SECRET_KEYS),
    };
  },

  async inquireTransaction(config, lookup: InquiryLookup, cacheKey: string): Promise<InquiryResult> {
    if (!lookup.transactionId) {
      throw new DeeplinkProviderError('scb_inquiry_missing_id', 'SCB inquiry needs a transaction id');
    }
    const token = await fetchToken(config, cacheKey);
    const res = await fetch(`${baseUrl(config)}${SCB_PATH.inquiry(lookup.transactionId)}`, {
      method: 'GET',
      headers: authHeaders(config, token),
    });
    const json = await readJson(res);
    if (!res.ok) {
      throw new DeeplinkProviderError('scb_inquiry_failed', 'SCB transaction inquiry failed', res.status);
    }
    const data = unwrapData(json);
    const billPayment = data.billPayment && typeof data.billPayment === 'object' ? (data.billPayment as Record<string, unknown>) : null;

    return {
      transactionId: pickString(data, ['transactionId', 'transactionID']) ?? lookup.transactionId,
      status: mapStatus(data),
      // VERIFY: amount field on the inquiry response.
      amountTHB: pickAmount(data, ['amount', 'paymentAmount']) ?? pickAmount(billPayment, ['paymentAmount', 'amount']),
      paidAt: pickString(data, ['transactionDateandTime', 'transactionDateTime', 'paidAt']),
      raw: sanitizeRaw(data, SECRET_KEYS),
    };
  },

  parseConfirmation(body: unknown): ConfirmationPayload | null {
    const parsed = SCB_CONFIRMATION_SCHEMA.safeParse(body);
    if (!parsed.success) return null;
    const d = parsed.data;
    const transactionId = pickString(d, ['transactionId']);
    const ref1 = d.billPaymentRef1?.trim() || null;
    if (!transactionId && !ref1) return null;
    return {
      transactionId,
      ref1,
      amountTHB: pickAmount(d, ['amount']),
      paidAt: d.transactionDateandTime ?? d.transactionDateTime ?? null,
    };
  },

  confirmationResponse(payload) {
    // VERIFY: the acknowledgement body SCB expects from the merchant's confirmation URL.
    return { resCode: '00', resDesc: 'success', transactionId: payload?.transactionId ?? '' };
  },
};
