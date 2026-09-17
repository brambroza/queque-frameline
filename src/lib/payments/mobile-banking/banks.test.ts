import { describe, expect, it } from 'vitest';
import { BANK_CODES } from '@/types/db';
import {
  MOBILE_BANKS,
  bankColor,
  bankDisplayName,
  detectOmisePlatform,
  isBankAppMethod,
  isMobileBankingAmountOk,
  parseBankCode,
  sourceTypeFor,
} from './banks';

describe('MOBILE_BANKS registry', () => {
  it('covers every BankCode exactly once, in picker order', () => {
    expect(MOBILE_BANKS.map((b) => b.code)).toEqual([...BANK_CODES]);
  });

  it('maps codes to Omise source types and brand colours', () => {
    expect(sourceTypeFor('kbank')).toBe('mobile_banking_kbank');
    expect(sourceTypeFor('bay')).toBe('mobile_banking_bay');
    expect(bankColor('scb')).toBe('#4e2e7f');
    expect(bankDisplayName('ktb')).toBe('Krungthai NEXT');
  });

  it('falls back gracefully for unknown codes', () => {
    expect(parseBankCode('tmb')).toBeNull();
    expect(parseBankCode(null)).toBeNull();
    expect(bankDisplayName('tmb')).toBe('tmb');
    expect(bankDisplayName(null)).toBe('ธนาคาร');
  });
});

describe('isMobileBankingAmountOk', () => {
  it('accepts the Omise range inclusive', () => {
    expect(isMobileBankingAmountOk(19.99)).toBe(false);
    expect(isMobileBankingAmountOk(20)).toBe(true);
    expect(isMobileBankingAmountOk(150_000)).toBe(true);
    expect(isMobileBankingAmountOk(150_000.01)).toBe(false);
    expect(isMobileBankingAmountOk(Number.NaN)).toBe(false);
  });
});

describe('detectOmisePlatform', () => {
  it('reads the platform from the user agent', () => {
    expect(detectOmisePlatform('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Line/14')).toBe('IOS');
    expect(detectOmisePlatform('Mozilla/5.0 (Linux; Android 14; Pixel 8) Line/14')).toBe('ANDROID');
    expect(detectOmisePlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)')).toBeNull();
    expect(detectOmisePlatform(null)).toBeNull();
  });
});

describe('isBankAppMethod', () => {
  it('is true for both bank-app methods only', () => {
    expect(isBankAppMethod('bank_deeplink')).toBe(true);
    expect(isBankAppMethod('omise_mobile_banking')).toBe(true);
    expect(isBankAppMethod('omise_promptpay')).toBe(false);
    expect(isBankAppMethod('bank_transfer')).toBe(false);
    expect(isBankAppMethod(null)).toBe(false);
  });
});
