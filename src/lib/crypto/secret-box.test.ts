import { describe, expect, it } from 'vitest';
import { createSecretBox } from './secret-box';

describe('createSecretBox', () => {
  it('round-trips a value and never produces the same ciphertext twice', () => {
    const box = createSecretBox(['seed-one']);
    const a = box.seal('{"applicationKey":"abc"}');
    const b = box.seal('{"applicationKey":"abc"}');
    expect(a).not.toBe(b);
    expect(a.startsWith('v1.')).toBe(true);
    expect(box.open(a)).toBe('{"applicationKey":"abc"}');
    expect(box.open(b)).toBe('{"applicationKey":"abc"}');
  });

  it('opens values sealed with an older seed (key rotation)', () => {
    const old = createSecretBox(['legacy-seed']);
    const sealed = old.seal('secret');
    const rotated = createSecretBox(['new-seed', 'legacy-seed']);
    expect(rotated.open(sealed)).toBe('secret');
    // …and new values use the new seed, which the old box cannot read.
    expect(() => old.open(rotated.seal('secret'))).toThrow();
  });

  it('rejects tampered ciphertext and malformed input', () => {
    const box = createSecretBox(['seed']);
    const sealed = box.seal('payload');
    const [v, iv, tag, ct] = sealed.split('.');
    const flipped = ct[0] === 'A' ? 'B' : 'A';
    expect(() => box.open([v, iv, tag, flipped + ct.slice(1)].join('.'))).toThrow();
    expect(() => box.open('v2.a.b.c')).toThrow();
    expect(() => box.open('garbage')).toThrow();
  });

  it('reports unconfigured when no seed is given and refuses to seal', () => {
    const box = createSecretBox(['', undefined as unknown as string]);
    expect(box.configured).toBe(false);
    expect(() => box.seal('x')).toThrow();
  });
});
