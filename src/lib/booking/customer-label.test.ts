import { describe, expect, it } from 'vitest';
import { customerLabel, customerNickname, nicknamePatch, normalizeNicknameInput, NICKNAME_MAX } from './customer-label';

describe('customerLabel', () => {
  it('leads with the nickname and keeps the real name in brackets', () => {
    expect(customerLabel({ full_name: 'ณัฐพล ใจดี', nickname: 'นัท' })).toBe('นัท (ณัฐพล ใจดี)');
  });

  it('falls back to the real name when there is no nickname', () => {
    expect(customerLabel({ full_name: 'ณัฐพล', nickname: null })).toBe('ณัฐพล');
    expect(customerLabel({ full_name: 'ณัฐพล', nickname: '   ' })).toBe('ณัฐพล');
  });

  it('does not repeat a nickname that equals the real name', () => {
    expect(customerLabel({ full_name: 'นัท', nickname: 'นัท' })).toBe('นัท');
  });

  it('returns a dash for a booking without a customer row', () => {
    expect(customerLabel(null)).toBe('-');
    expect(customerLabel({ full_name: '', nickname: '' })).toBe('-');
  });
});

describe('customerNickname', () => {
  it('trims and nulls blanks', () => {
    expect(customerNickname({ nickname: '  นัท ' })).toBe('นัท');
    expect(customerNickname({ nickname: '' })).toBeNull();
    expect(customerNickname(undefined)).toBeNull();
  });
});

describe('normalizeNicknameInput', () => {
  it('keeps undefined (do not touch) distinct from empty (clear)', () => {
    expect(normalizeNicknameInput(undefined)).toBeUndefined();
    expect(normalizeNicknameInput('')).toBeNull();
    expect(normalizeNicknameInput('  ')).toBeNull();
    expect(normalizeNicknameInput(null)).toBeNull();
  });

  it('trims and caps at the column limit', () => {
    expect(normalizeNicknameInput(' นัท ')).toBe('นัท');
    expect(normalizeNicknameInput('x'.repeat(NICKNAME_MAX + 20))).toHaveLength(NICKNAME_MAX);
  });
});

describe('nicknamePatch', () => {
  it('leaves the stored nickname alone when the field is omitted', () => {
    expect(nicknamePatch(undefined)).toEqual({});
    expect({ full_name: 'ณัฐพล', ...nicknamePatch(undefined) }).not.toHaveProperty('nickname');
  });

  it('clears on empty or null and writes a trimmed value otherwise', () => {
    expect(nicknamePatch('')).toEqual({ nickname: null });
    expect(nicknamePatch(null)).toEqual({ nickname: null });
    expect(nicknamePatch(' นัท ')).toEqual({ nickname: 'นัท' });
  });
});
