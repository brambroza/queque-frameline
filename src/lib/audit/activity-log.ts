import { createAdminClient } from '@/lib/supabase/admin';

type AuditInput = {
  companyId?: string | null;
  shopId?: string | null;
  userId?: string | null;
  action: string;
  targetTable?: string | null;
  targetId?: string | null;
  payload?: Record<string, unknown> | null;
};

export type CrudOp = 'create' | 'update' | 'delete';

/** Who did it — the `user` + `profile` pair every route already gets from `requireAuthContext`. */
export type CrudActor = {
  user: { id: string };
  profile: { company_id?: string | null; shop_id?: string | null };
};

const CRUD_ACTIONS: Record<CrudOp, string> = {
  create: 'data_created',
  update: 'data_updated',
  delete: 'data_deleted',
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Keys whose values must never reach the log, whatever the route passes in. */
const SECRET_KEY_PATTERN = /(token|secret|password|api_key|key_hash|raw_key|authorization|image_base64|signature)/i;

const MAX_STRING_LENGTH = 500;
const MAX_DEPTH = 4;

/**
 * Returns a copy of `value` that is safe to store: secret-looking keys are masked,
 * long strings are cut and nesting is capped so one request cannot bloat the table.
 */
export function sanitizeAuditPayload(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') {
    return value.length > MAX_STRING_LENGTH ? `${value.slice(0, MAX_STRING_LENGTH)}…` : value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (depth >= MAX_DEPTH) return '[truncated]';
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => sanitizeAuditPayload(item, depth + 1));
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      // Secrets are strings; numbers / booleans under such a key are settings (e.g. `booking_token_ttl_days`).
      const secret = SECRET_KEY_PATTERN.test(key) && typeof item !== 'number' && typeof item !== 'boolean' && item !== null;
      out[key] = secret ? '[redacted]' : sanitizeAuditPayload(item, depth + 1);
    }
    return out;
  }
  return String(value);
}

/** `activity_logs.target_id` is a uuid column — anything else would make the insert fail. */
export function toAuditTargetId(id: unknown): string | null {
  return typeof id === 'string' && UUID_PATTERN.test(id) ? id : null;
}

/**
 * Writes one row to `activity_logs`. Best-effort: never throws, so audit logging
 * cannot break the primary business flow.
 */
export async function writeAuditLog(input: AuditInput) {
  try {
    const admin = createAdminClient();
    await admin.from('activity_logs').insert({
      company_id: input.companyId ?? null,
      shop_id: input.shopId ?? null,
      user_id: input.userId ?? null,
      action: input.action,
      target_table: input.targetTable ?? null,
      target_id: input.targetId ?? null,
      payload: input.payload ?? null,
      created_by: input.userId ?? null,
      updated_by: input.userId ?? null,
    });
  } catch {
    // Best-effort only: audit logging must not break primary business flow.
  }
}

/**
 * Logs a create / update / delete done from the portal.
 * `id` that is not a uuid (composite keys, settings keys) is kept in the payload as `ref`.
 */
export async function logCrud(
  actor: CrudActor,
  op: CrudOp,
  table: string,
  id: unknown,
  payload?: Record<string, unknown> | null,
) {
  const targetId = toAuditTargetId(id);
  const safe = (sanitizeAuditPayload(payload ?? {}) ?? {}) as Record<string, unknown>;
  if (!targetId && id !== null && id !== undefined && id !== '') safe.ref = String(id).slice(0, 120);

  await writeAuditLog({
    companyId: actor.profile.company_id ?? null,
    shopId: actor.profile.shop_id ?? null,
    userId: actor.user.id,
    action: CRUD_ACTIONS[op],
    targetTable: table,
    targetId,
    payload: safe,
  });
}
