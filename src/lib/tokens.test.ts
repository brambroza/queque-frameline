import { describe, expect, it } from 'vitest';
import { expiryFromNow, generateApiKey, generateToken, hashToken, hashesEqual, isWellFormedToken, tokenState } from './tokens';

describe('tokens', () => {
  it('generates unique url-safe tokens', () => {
    const a = generateToken();
    const b = generateToken();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(isWellFormedToken(a)).toBe(true);
  });
  it('rejects malformed tokens', () => {
    expect(isWellFormedToken('short')).toBe(false);
    expect(isWellFormedToken('../../etc/passwd'.padEnd(40, 'x'))).toBe(false);
    expect(isWellFormedToken(null)).toBe(false);
  });
  it('hashes deterministically and compares in constant time', () => {
    const t = generateToken();
    expect(hashToken(t)).toBe(hashToken(t));
    expect(hashToken(t)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashesEqual(hashToken(t), hashToken(t))).toBe(true);
    expect(hashesEqual(hashToken(t), hashToken(`${t}x`))).toBe(false);
    expect(hashesEqual('', '')).toBe(false);
  });
  it('tracks expiry', () => {
    const now = new Date('2026-09-21T00:00:00Z');
    expect(tokenState(null, now)).toBe('ok');
    expect(tokenState(expiryFromNow(now, 7), now)).toBe('ok');
    expect(tokenState('2026-09-20T23:59:59Z', now)).toBe('expired');
    expect(expiryFromNow(now, 1)).toBe('2026-09-22T00:00:00.000Z');
  });
  it('builds API keys with a display prefix', () => {
    const k = generateApiKey();
    expect(k.raw.startsWith('flq_')).toBe(true);
    expect(k.prefix).toBe(k.raw.slice(0, 10));
    expect(k.hash).toBe(hashToken(k.raw));
  });
});
