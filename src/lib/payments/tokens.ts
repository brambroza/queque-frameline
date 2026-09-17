import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Short HMAC tokens for public payment links.
 *
 * Without one, a booking uuid is the only thing standing between a stranger and
 * a shop's PromptPay QR. The token costs nothing to mint and closes that.
 */

let warnedMissingSecret = false;

function secret(): string {
  const value = process.env.PAYMENT_LINK_SECRET ?? '';
  if (!value && !warnedMissingSecret) {
    warnedMissingSecret = true;
    console.warn('[payments] PAYMENT_LINK_SECRET is not set — payment link tokens are not enforced');
  }
  return value;
}

/** Mint the `t` query param for a booking's public payment URLs. */
export function signBookingToken(bookingId: string): string {
  const key = secret();
  if (!key) return '';
  return createHmac('sha256', key).update(bookingId).digest('hex').slice(0, 16);
}

/**
 * Verify a token against a booking id.
 * Returns true when no secret is configured, so existing deployments keep working.
 */
export function verifyBookingToken(bookingId: string, token: string | null | undefined): boolean {
  const key = secret();
  if (!key) return true;
  const expected = Buffer.from(signBookingToken(bookingId));
  const given = Buffer.from(token ?? '');
  if (expected.length !== given.length) return false;
  return timingSafeEqual(expected, given);
}
