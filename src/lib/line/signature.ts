import { createHmac, timingSafeEqual } from 'node:crypto';

/** LINE signs the raw webhook body with the channel secret (HMAC-SHA256, base64). */
export function verifyLineSignature(channelSecret: string, rawBody: string, signature: string | null): boolean {
  if (!channelSecret || !signature) return false;
  const expected = Buffer.from(createHmac('sha256', channelSecret).update(rawBody).digest('base64'));
  const got = Buffer.from(signature);
  return expected.length === got.length && timingSafeEqual(expected, got);
}
