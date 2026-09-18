import { describe, expect, it } from 'vitest';
import { addFriendUrl, liffUrl } from './config';

describe('liffUrl', () => {
  it('builds a LIFF deep link that flags the LINE origin', () => {
    expect(liffUrl({ liff_id: '1234567890-abcdefgh' }, '/book/tok')).toBe('https://liff.line.me/1234567890-abcdefgh/book/tok?via=line');
    expect(liffUrl({ liff_id: '1234567890-abcdefgh' }, 'driver/tok?x=1')).toBe('https://liff.line.me/1234567890-abcdefgh/driver/tok?x=1&via=line');
    expect(liffUrl({ liff_id: null }, '/book/tok')).toBeNull();
  });
  it('normalises the OA basic id', () => {
    expect(addFriendUrl({ oa_basic_id: '@fameline' })).toBe('https://line.me/R/ti/p/@fameline');
    expect(addFriendUrl({ oa_basic_id: 'fameline' })).toBe('https://line.me/R/ti/p/@fameline');
    expect(addFriendUrl({ oa_basic_id: null })).toBeNull();
  });
});
