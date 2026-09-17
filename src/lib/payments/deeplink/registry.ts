import { BANK_PROVIDERS, type BankProvider } from '@/types/db';
import type { BankDeeplinkAdapter } from './types';
import { scbAdapter } from './scb';
import { kbankAdapter } from './kbank';

const ADAPTERS: Record<BankProvider, BankDeeplinkAdapter> = {
  scb: scbAdapter,
  kbank: kbankAdapter,
};

/**
 * Deployment-level kill switch per bank. A shop can hold credentials for a bank
 * that is switched off here — its button simply never reaches customers. KBank
 * defaults to off because its field names are unverified against partner docs.
 */
const AVAILABILITY_ENV: Record<BankProvider, { key: string; defaultValue: boolean }> = {
  scb: { key: 'DEEPLINK_SCB_ENABLED', defaultValue: true },
  kbank: { key: 'DEEPLINK_KBANK_ENABLED', defaultValue: false },
};

function readFlag(key: string, defaultValue: boolean): boolean {
  const raw = process.env[key];
  if (raw === undefined || raw === '') return defaultValue;
  return ['1', 'true', 'yes', 'on'].includes(raw.trim().toLowerCase());
}

export function getDeeplinkAdapter(provider: BankProvider): BankDeeplinkAdapter {
  return ADAPTERS[provider];
}

export function isProviderAvailable(provider: BankProvider): boolean {
  const flag = AVAILABILITY_ENV[provider];
  return readFlag(flag.key, flag.defaultValue);
}

export function providerDisplayName(provider: BankProvider): string {
  return ADAPTERS[provider].displayName;
}

/** Narrow an unknown value to a BankProvider, or null. */
export function parseBankProvider(value: unknown): BankProvider | null {
  return typeof value === 'string' && (BANK_PROVIDERS as readonly string[]).includes(value)
    ? (value as BankProvider)
    : null;
}

/** Every provider, in picker order, with its current availability. */
export function listProviders(): Array<{ provider: BankProvider; displayName: string; available: boolean }> {
  return BANK_PROVIDERS.map((provider) => ({
    provider,
    displayName: providerDisplayName(provider),
    available: isProviderAvailable(provider),
  }));
}
