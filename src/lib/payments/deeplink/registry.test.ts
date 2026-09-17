import { afterEach, describe, expect, it } from 'vitest';
import { isProviderAvailable, listProviders, parseBankProvider, providerDisplayName } from './registry';

const ORIGINAL = { scb: process.env.DEEPLINK_SCB_ENABLED, kbank: process.env.DEEPLINK_KBANK_ENABLED };

afterEach(() => {
  if (ORIGINAL.scb === undefined) delete process.env.DEEPLINK_SCB_ENABLED; else process.env.DEEPLINK_SCB_ENABLED = ORIGINAL.scb;
  if (ORIGINAL.kbank === undefined) delete process.env.DEEPLINK_KBANK_ENABLED; else process.env.DEEPLINK_KBANK_ENABLED = ORIGINAL.kbank;
});

describe('registry availability flags', () => {
  it('defaults SCB on and KBank off', () => {
    delete process.env.DEEPLINK_SCB_ENABLED;
    delete process.env.DEEPLINK_KBANK_ENABLED;
    expect(isProviderAvailable('scb')).toBe(true);
    expect(isProviderAvailable('kbank')).toBe(false);
  });

  it('honours explicit env flags', () => {
    process.env.DEEPLINK_SCB_ENABLED = 'false';
    process.env.DEEPLINK_KBANK_ENABLED = 'true';
    expect(isProviderAvailable('scb')).toBe(false);
    expect(isProviderAvailable('kbank')).toBe(true);
    expect(listProviders().map((p) => [p.provider, p.available])).toEqual([['scb', false], ['kbank', true]]);
  });

  it('exposes display names and narrows unknown providers', () => {
    expect(providerDisplayName('scb')).toBe('SCB Easy');
    expect(providerDisplayName('kbank')).toBe('K PLUS');
    expect(parseBankProvider('scb')).toBe('scb');
    expect(parseBankProvider('ttb')).toBeNull();
    expect(parseBankProvider(42)).toBeNull();
  });
});
