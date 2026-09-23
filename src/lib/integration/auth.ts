/**
 * API-key gate for `/api/integration/*` (ERP push).
 *
 * The key travels in `X-API-Key` (or `Authorization: Bearer`), never in the
 * query string. The database keeps only sha256(key), so the lookup is an
 * indexed equality on the hash — no constant-time compare is needed (a timing
 * leak on the hash cannot be turned back into the key). The site (shop /
 * company) comes from the key row, never from the request.
 */
import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { hashToken } from '@/lib/tokens';

export type ApiKeyScope = 'documents:write';

export type ApiKeyContext = {
  /** Service-role client; every query must still be scoped by `site`. */
  admin: SupabaseClient;
  site: { shopId: string; companyId: string };
  keyId: string;
  keyName: string;
  keyPrefix: string;
  scopes: string[];
};

/** Route-level failure with a stable machine code. The message never carries the key or the body. */
export class IntegrationError extends Error {
  constructor(
    public readonly status: 400 | 401 | 403 | 413,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'IntegrationError';
  }
}

/** `generateApiKey()` = 'flq_' + 32 random bytes as base64url (43 chars). */
const KEY_RE = /^flq_[A-Za-z0-9_-]{43}$/;

/** How often `last_used_at` is re-stamped for a busy key. */
const LAST_USED_THROTTLE_MS = 60_000;

/**
 * Pull the raw key out of the request headers.
 *
 * @returns The key when it is well-formed, else null. Malformed and missing
 *   look the same to the caller on purpose.
 */
export function extractApiKey(headers: Headers): string | null {
  const direct = headers.get('x-api-key')?.trim();
  if (direct) return KEY_RE.test(direct) ? direct : null;
  const auth = headers.get('authorization')?.trim() ?? '';
  const m = /^Bearer\s+(\S+)$/i.exec(auth);
  return m && KEY_RE.test(m[1]) ? m[1] : null;
}

/** First hop of `x-forwarded-for` (Vercel sets it), else `x-real-ip`, else null. */
export function clientIp(headers: Headers): string | null {
  const fwd = headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return fwd || headers.get('x-real-ip')?.trim() || null;
}

/**
 * Resolve the caller's API key.
 *
 * @param req Incoming request.
 * @param scope Scope the route needs; omit for read-only checks such as `/health`.
 * @throws IntegrationError 401 (`invalid_api_key`, `api_key_revoked`) or 403 (`insufficient_scope`).
 */
export async function requireApiKey(req: Request, scope?: ApiKeyScope): Promise<ApiKeyContext> {
  const raw = extractApiKey(req.headers);
  if (!raw) throw new IntegrationError(401, 'invalid_api_key', 'Unauthorized');

  const admin = createAdminClient();
  const { data: row } = await admin
    .from('api_keys')
    .select('id,name,key_prefix,company_id,shop_id,scopes,active,is_deleted,last_used_at')
    .eq('key_hash', hashToken(raw))
    .maybeSingle();
  if (!row) throw new IntegrationError(401, 'invalid_api_key', 'Unauthorized');
  if (!row.active || row.is_deleted) throw new IntegrationError(401, 'api_key_revoked', 'API key revoked');

  const scopes = Array.isArray(row.scopes) ? (row.scopes as string[]) : [];
  if (scope && !scopes.includes(scope)) throw new IntegrationError(403, 'insufficient_scope', `Scope ${scope} required`);

  // Stamp at most once a minute so a nightly resync does not write on every call. Never fatal.
  const lastUsed = row.last_used_at ? new Date(row.last_used_at as string).getTime() : 0;
  if (Date.now() - lastUsed > LAST_USED_THROTTLE_MS) {
    try {
      await admin.from('api_keys').update({ last_used_at: new Date().toISOString(), last_used_ip: clientIp(req.headers) }).eq('id', row.id);
    } catch {
      // best effort
    }
  }

  return {
    admin,
    site: { shopId: row.shop_id as string, companyId: row.company_id as string },
    keyId: row.id as string,
    keyName: String(row.name),
    keyPrefix: String(row.key_prefix),
    scopes,
  };
}

/** JSON body for a thrown error. Unknown errors are logged without the request and answered generically. */
export function integrationErrorResponse(e: unknown): NextResponse {
  if (e instanceof IntegrationError) {
    return NextResponse.json({ error: e.message, code: e.code }, { status: e.status, headers: { 'Cache-Control': 'no-store' } });
  }
  console.error('[integration]', e instanceof Error ? e.message : e);
  return NextResponse.json({ error: 'Unexpected error', code: 'internal_error' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
}
