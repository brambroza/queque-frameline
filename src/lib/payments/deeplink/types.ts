import type { BankProvider } from '@/types/db';

export type DeeplinkEnvironment = 'sandbox' | 'production';

/**
 * A shop's decrypted configuration for one bank. Server-only: `credentials`
 * holds the raw API secrets and must never reach a response or a log line.
 */
export interface DeeplinkProviderConfig {
  id: string;
  provider: BankProvider;
  environment: DeeplinkEnvironment;
  /** SCB Biller ID / KBank merchant id — the account money settles into. */
  billerId: string;
  merchantName: string | null;
  sessionMinutes: number;
  webhookSecret: string;
  /** Adapter-owned shape, already validated by `adapter.parseCredentials`. */
  credentials: unknown;
}

export interface CreateDeeplinkInput {
  amountTHB: number;
  /** Our short reference (bookings.bank_txn_ref). Bank-safe charset, ≤ 20 chars. */
  ref1: string;
  /** Secondary reference shown on the bank statement, e.g. the queue number. */
  ref2: string;
  /** Human-readable line shown inside the bank app. */
  description: string;
  sessionMinutes: number;
  /** Where the bank app sends the customer after paying. */
  returnUrl: string;
  merchantName: string;
  /** Distinguishes token caches between shops and environments. */
  cacheKey: string;
}

export interface CreateDeeplinkResult {
  /** The bank's transaction id. */
  transactionId: string;
  deeplinkUrl: string;
  expiresAt: string;
  /** Sanitized response — never contains the deeplink or any secret. */
  raw: Record<string, unknown>;
}

export type BankTxnStatus = 'pending' | 'paid' | 'failed' | 'expired';

export interface InquiryResult {
  transactionId: string;
  status: BankTxnStatus;
  /** Null when the bank does not echo the amount back. */
  amountTHB: number | null;
  paidAt: string | null;
  raw: Record<string, unknown>;
}

/** What a bank confirmation callback tells us — used only to locate the booking, never as proof. */
export interface ConfirmationPayload {
  transactionId: string | null;
  ref1: string | null;
  amountTHB: number | null;
  paidAt: string | null;
}

export interface InquiryLookup {
  transactionId: string | null;
  /** Our reference (bank_txn_ref); some banks key their inquiry API on this. */
  ref1: string | null;
}

/**
 * One implementation per bank. Every bank-specific field name lives inside the
 * adapter file, so verifying against portal docs touches exactly one place.
 */
export interface BankDeeplinkAdapter {
  readonly provider: BankProvider;
  /** Customer-facing app name, e.g. "SCB Easy". */
  readonly displayName: string;
  /** Validate the credential JSON entered in the portal. Throws on invalid input. */
  parseCredentials(input: unknown): unknown;
  /** Last characters of the primary key, for a masked "configured" hint. */
  credentialsHint(credentials: unknown): string;
  /** Obtain an access token — used by the portal "test connection" button. */
  authorize(config: DeeplinkProviderConfig, cacheKey: string): Promise<void>;
  createTransaction(config: DeeplinkProviderConfig, input: CreateDeeplinkInput): Promise<CreateDeeplinkResult>;
  inquireTransaction(config: DeeplinkProviderConfig, lookup: InquiryLookup, cacheKey: string): Promise<InquiryResult>;
  /** Zod-parse a confirmation callback body. Null when it is not recognisable. */
  parseConfirmation(body: unknown): ConfirmationPayload | null;
  /** Body the bank expects back from its confirmation callback. */
  confirmationResponse(payload: ConfirmationPayload | null): Record<string, unknown>;
}

/**
 * Raised for any upstream failure. The message is safe to log and to surface
 * to a shop owner; it never carries the bank's response body.
 */
export class DeeplinkProviderError extends Error {
  readonly code: string;
  readonly httpStatus: number | null;

  constructor(code: string, message: string, httpStatus: number | null = null) {
    super(message);
    this.name = 'DeeplinkProviderError';
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

/**
 * Shared bearer-token cache. Keyed by the caller's cacheKey (config id +
 * environment) so tokens never cross tenants. Module-level on purpose: on a
 * warm serverless instance this saves a round trip per booking.
 */
const tokenCache = new Map<string, { token: string; expiresAt: number }>();
const TOKEN_SAFETY_MARGIN_MS = 60_000;

export function getCachedToken(cacheKey: string): string | null {
  const hit = tokenCache.get(cacheKey);
  if (!hit) return null;
  if (hit.expiresAt - TOKEN_SAFETY_MARGIN_MS <= Date.now()) {
    tokenCache.delete(cacheKey);
    return null;
  }
  return hit.token;
}

export function setCachedToken(cacheKey: string, token: string, expiresInSeconds: number) {
  const ttl = Number.isFinite(expiresInSeconds) && expiresInSeconds > 0 ? expiresInSeconds : 300;
  tokenCache.set(cacheKey, { token, expiresAt: Date.now() + ttl * 1000 });
}

/** Test hook — clears every cached token. */
export function clearTokenCache() {
  tokenCache.clear();
}

/** Read a string-ish value from an unknown record, trying several candidate keys. */
export function pickString(source: unknown, keys: readonly string[]): string | null {
  if (!source || typeof source !== 'object') return null;
  const record = source as Record<string, unknown>;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return null;
}

/** Read a numeric amount (number or numeric string) from an unknown record. */
export function pickAmount(source: unknown, keys: readonly string[]): number | null {
  if (!source || typeof source !== 'object') return null;
  const record = source as Record<string, unknown>;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value.replace(/,/g, ''));
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

/** Strip anything that must not be persisted in an audit row. */
export function sanitizeRaw(source: unknown, dropKeys: readonly string[]): Record<string, unknown> {
  if (!source || typeof source !== 'object' || Array.isArray(source)) return {};
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(source as Record<string, unknown>)) {
    if (dropKeys.includes(key)) continue;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      out[key] = sanitizeRaw(value, dropKeys);
    } else {
      out[key] = value;
    }
  }
  return out;
}
