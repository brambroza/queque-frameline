/**
 * Opaque link tokens (customer booking link, driver link, API keys).
 *
 * The raw token exists only in the URL handed to the recipient; the database
 * keeps its sha256. Server-only module (node:crypto).
 */
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/** 32 random bytes, base64url — 43 characters, URL safe. */
export function generateToken(): string {
  return randomBytes(32).toString('base64url');
}

/** sha256 hex of a token; what gets stored and looked up. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

/** Shape check before touching the DB, so junk paths cost nothing. */
export function isWellFormedToken(token: string | null | undefined): token is string {
  return typeof token === 'string' && /^[A-Za-z0-9_-]{32,64}$/.test(token);
}

/** Constant-time comparison of two hex digests. */
export function hashesEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a, 'hex');
  const bb = Buffer.from(b, 'hex');
  return ba.length === bb.length && ba.length > 0 && timingSafeEqual(ba, bb);
}

export type TokenState = 'ok' | 'expired';

/** Expiry check against the server clock; a null expiry never expires. */
export function tokenState(expiresAt: string | null | undefined, now: Date): TokenState {
  if (!expiresAt) return 'ok';
  return new Date(expiresAt).getTime() > now.getTime() ? 'ok' : 'expired';
}

/** Expiry `days` from `from`, as ISO string. */
export function expiryFromNow(from: Date, days: number): string {
  return new Date(from.getTime() + days * 86_400_000).toISOString();
}

/** API key shown once: `flq_<token>`; the prefix is stored for display. */
export function generateApiKey(): { raw: string; hash: string; prefix: string } {
  const raw = `flq_${generateToken()}`;
  return { raw, hash: hashToken(raw), prefix: raw.slice(0, 10) };
}

/** What a derived link token opens. */
export type LinkKind = 'booking' | 'driver';

function tokenSecret(): string {
  const secret = process.env.TOKEN_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error('TOKEN_SECRET is not configured');
  return secret;
}

/**
 * Deterministic link token: HMAC-SHA256(TOKEN_SECRET, `kind:id:version`).
 *
 * The DB stores sha256(token) + the version. Because the token can be derived
 * again from (kind, id, version), the portal can re-show a link or QR without
 * ever persisting the raw value; regenerate = version + 1.
 *
 * @param kind `booking` (external_documents.id) or `driver` (bookings.id).
 * @param id Row id the link belongs to.
 * @param version Current token version of that row.
 */
export function deriveLinkToken(kind: LinkKind, id: string, version: number): string {
  return createHmac('sha256', tokenSecret()).update(`${kind}:${id}:${version}`, 'utf8').digest('base64url');
}
