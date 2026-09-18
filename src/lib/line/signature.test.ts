import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { verifyLineSignature } from './signature';

describe('verifyLineSignature', () => {
  const secret = 'test-secret';
  const body = '{"events":[]}';
  const good = createHmac('sha256', secret).update(body).digest('base64');

  it('accepts the HMAC LINE computes and rejects everything else', () => {
    expect(verifyLineSignature(secret, body, good)).toBe(true);
    expect(verifyLineSignature(secret, body + ' ', good)).toBe(false);
    expect(verifyLineSignature('other', body, good)).toBe(false);
    expect(verifyLineSignature(secret, body, null)).toBe(false);
    expect(verifyLineSignature('', body, good)).toBe(false);
  });
});
