/**
 * Driver link issuing. The link is derived (see `deriveLinkToken`), but it only
 * opens once its hash is stored — so it is issued the moment a queue is confirmed.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { deriveLinkToken, hashToken } from '@/lib/tokens';
import { driverUrl } from '@/lib/links';

/** Driver link lives until `ttlDays` after the appointment day (Bangkok end of day). */
export function driverLinkExpiry(bookingDate: string, ttlDays: number): string {
  return new Date(new Date(`${bookingDate.slice(0, 10)}T23:59:59+07:00`).getTime() + ttlDays * 86_400_000).toISOString();
}

/**
 * Make sure the booking's current driver link works; returns its URL.
 * Idempotent. Never throws — a missing link must not fail a confirmation.
 *
 * @param client Client allowed to update the booking (session or service role).
 * @param b Booking id, site, date and current token version.
 * @param ttlDays `site_settings.driver_token_ttl_days`.
 */
export async function ensureDriverLink(
  client: SupabaseClient,
  b: { id: string; shopId: string; bookingDate: string; version: number },
  ttlDays: number,
): Promise<string | null> {
  try {
    const token = deriveLinkToken('driver', b.id, b.version);
    const { error } = await client
      .from('bookings')
      .update({ driver_token_hash: hashToken(token), driver_token_version: b.version, driver_token_expires_at: driverLinkExpiry(b.bookingDate, ttlDays) })
      .eq('id', b.id)
      .eq('shop_id', b.shopId);
    if (error) throw error;
    return driverUrl(token);
  } catch (e) {
    console.error('[driver-link] issue failed:', e instanceof Error ? e.message : e);
    return null;
  }
}
