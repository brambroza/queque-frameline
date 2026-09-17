import { describe, expect, it } from 'vitest';
import { applyNameMode, signageDisplayName } from './normalize';

describe('applyNameMode', () => {
  it('masks to the first character', () => {
    expect(applyNameMode('ณัฐพล', 'masked')).toBe('ณ***');
  });
  it('hides or shows in full', () => {
    expect(applyNameMode('ณัฐพล', 'hidden')).toBeNull();
    expect(applyNameMode('ณัฐพล', 'full')).toBe('ณัฐพล');
    expect(applyNameMode('  ', 'full')).toBeNull();
  });
});

describe('signageDisplayName', () => {
  const customer = { full_name: 'ณัฐพล ใจดี', nickname: 'นัท' };

  it('shows the nickname in full even when names are masked', () => {
    expect(signageDisplayName(customer, null, 'masked')).toBe('นัท');
    expect(signageDisplayName(customer, null, 'full')).toBe('นัท');
  });

  it('respects a shop that hides names entirely', () => {
    expect(signageDisplayName(customer, null, 'hidden')).toBeNull();
  });

  it('masks the real name when there is no nickname', () => {
    expect(signageDisplayName({ full_name: 'ณัฐพล', nickname: null }, null, 'masked')).toBe('ณ***');
    expect(signageDisplayName({ full_name: 'ณัฐพล', nickname: '  ' }, null, 'masked')).toBe('ณ***');
  });

  it('falls back to the LINE display name without a customer row', () => {
    expect(signageDisplayName(null, 'LINE Nat', 'masked')).toBe('L***');
    expect(signageDisplayName(null, null, 'full')).toBeNull();
  });
});
