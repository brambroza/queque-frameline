import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Private bucket holding customer-uploaded transfer slips.
 *
 * Private on purpose, unlike shop-assets and chat-media: a slip is a fragment of
 * a bank statement (payer name, partial account, amount, timestamp). A public
 * object URL would be a bearer token that never expires and would end up in
 * access logs, LINE chat history, and browser history. Reads go through a signed
 * URL minted server-side after an authorization check.
 */
export const PAYMENT_SLIP_BUCKET = 'payment-slips';

export const SLIP_MAX_BYTES = 5 * 1024 * 1024;
export const SLIP_ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'] as const;

/** How long a slip signed URL stays valid, in seconds. */
export const SLIP_SIGNED_URL_TTL = 300;

export interface EnsureBucketOptions {
  public: boolean;
  fileSizeLimit: number;
  allowedMimeTypes?: string[];
}

/**
 * Create a storage bucket if it does not exist yet.
 *
 * This project has no declarative storage migrations — buckets are created
 * lazily on first use, so this mirrors that existing convention.
 */
export async function ensureBucket(
  admin: SupabaseClient,
  name: string,
  opts: EnsureBucketOptions,
): Promise<void> {
  const { data: bucket } = await admin.storage.getBucket(name);
  if (bucket) return;
  const { error } = await admin.storage.createBucket(name, {
    public: opts.public,
    fileSizeLimit: opts.fileSizeLimit,
    allowedMimeTypes: opts.allowedMimeTypes,
  });
  // A concurrent request may have won the race — that is not a failure.
  if (error && !/already exists/i.test(error.message)) throw error;
}

/** Create the payment-slips bucket with its intended, locked-down settings. */
export function ensurePaymentSlipBucket(admin: SupabaseClient): Promise<void> {
  return ensureBucket(admin, PAYMENT_SLIP_BUCKET, {
    public: false,
    fileSizeLimit: SLIP_MAX_BYTES,
    allowedMimeTypes: [...SLIP_ALLOWED_MIME],
  });
}

/**
 * Mint a short-lived signed URL for one slip.
 * Returns null rather than throwing so a listing never fails over one bad row.
 */
export async function signSlipUrl(admin: SupabaseClient, storagePath: string): Promise<string | null> {
  const { data, error } = await admin.storage
    .from(PAYMENT_SLIP_BUCKET)
    .createSignedUrl(storagePath, SLIP_SIGNED_URL_TTL);
  if (error) {
    console.error('[storage] signed url error:', error.message);
    return null;
  }
  return data?.signedUrl ?? null;
}

/** Mint signed URLs for many slips at once, keyed by storage path. */
export async function signSlipUrls(
  admin: SupabaseClient,
  storagePaths: string[],
): Promise<Record<string, string>> {
  if (storagePaths.length === 0) return {};
  const { data, error } = await admin.storage
    .from(PAYMENT_SLIP_BUCKET)
    .createSignedUrls(storagePaths, SLIP_SIGNED_URL_TTL);
  if (error) {
    console.error('[storage] signed urls error:', error.message);
    return {};
  }
  const out: Record<string, string> = {};
  for (const row of data ?? []) {
    if (row.path && row.signedUrl) out[row.path] = row.signedUrl;
  }
  return out;
}
