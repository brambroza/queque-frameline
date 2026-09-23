import { describe, expect, it } from 'vitest';
import { clientIp, extractApiKey } from './auth';

const KEY = `flq_${'a'.repeat(43)}`;

describe('extractApiKey', () => {
  it('reads X-API-Key', () => {
    expect(extractApiKey(new Headers({ 'x-api-key': KEY }))).toBe(KEY);
    expect(extractApiKey(new Headers({ 'X-API-Key': ` ${KEY} ` }))).toBe(KEY);
  });

  it('falls back to a Bearer token', () => {
    expect(extractApiKey(new Headers({ authorization: `Bearer ${KEY}` }))).toBe(KEY);
    expect(extractApiKey(new Headers({ authorization: `bearer ${KEY}` }))).toBe(KEY);
  });

  it('rejects malformed or missing keys', () => {
    expect(extractApiKey(new Headers())).toBeNull();
    expect(extractApiKey(new Headers({ 'x-api-key': 'flq_short' }))).toBeNull();
    expect(extractApiKey(new Headers({ 'x-api-key': `abc_${'a'.repeat(43)}` }))).toBeNull();
    expect(extractApiKey(new Headers({ authorization: KEY }))).toBeNull();
    expect(extractApiKey(new Headers({ authorization: `Basic ${KEY}` }))).toBeNull();
  });

  it('prefers the header over a malformed bearer and never reads the query string', () => {
    expect(extractApiKey(new Headers({ 'x-api-key': 'nope', authorization: `Bearer ${KEY}` }))).toBeNull();
  });
});

describe('clientIp', () => {
  it('takes the first forwarded hop', () => {
    expect(clientIp(new Headers({ 'x-forwarded-for': '203.0.113.9, 10.0.0.1' }))).toBe('203.0.113.9');
    expect(clientIp(new Headers({ 'x-real-ip': '198.51.100.2' }))).toBe('198.51.100.2');
    expect(clientIp(new Headers())).toBeNull();
  });
});
