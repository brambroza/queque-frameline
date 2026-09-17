import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { scbAdapter, toScbRef } from './scb';
import { clearTokenCache, DeeplinkProviderError, type DeeplinkProviderConfig } from './types';

const config: DeeplinkProviderConfig = {
  id: 'row-1',
  provider: 'scb',
  environment: 'sandbox',
  billerId: '012345678901234',
  merchantName: 'ร้านทดสอบ',
  sessionMinutes: 15,
  webhookSecret: 'whsec',
  credentials: { applicationKey: 'app-key-12345678', applicationSecret: 'app-secret-12345678' },
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  clearTokenCache();
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function queueToken() {
  fetchMock.mockResolvedValueOnce(jsonResponse({ status: { code: 1000 }, data: { accessToken: 'tok-1', expiresIn: 1800 } }));
}

describe('scbAdapter.createTransaction', () => {
  it('authorizes, posts a locked-amount bill payment, and maps the deeplink', async () => {
    queueToken();
    fetchMock.mockResolvedValueOnce(jsonResponse({ status: { code: 1000 }, data: { transactionId: 'TXN-1', deeplinkUrl: 'scbeasy://purchase/abc', userRefId: 'u1' } }));

    const result = await scbAdapter.createTransaction(config, {
      amountTHB: 150.5,
      ref1: 'abcdefgh23456789',
      ref2: 'Q-001',
      description: 'ร้านทดสอบ Q-001',
      sessionMinutes: 15,
      returnUrl: 'https://app.example/liff/shop/pay/return?booking_id=b1&t=tok',
      merchantName: 'ร้านทดสอบ',
      cacheKey: 'scb:row-1:sandbox',
    });

    expect(result.transactionId).toBe('TXN-1');
    expect(result.deeplinkUrl).toBe('scbeasy://purchase/abc');
    expect(new Date(result.expiresAt).getTime()).toBeGreaterThan(Date.now() + 14 * 60_000);
    expect(result.raw).not.toHaveProperty('deeplinkUrl');

    const [tokenUrl, tokenInit] = fetchMock.mock.calls[0];
    expect(String(tokenUrl)).toBe('https://api-sandbox.partners.scb/partners/sandbox/v1/oauth/token');
    expect(JSON.parse(String(tokenInit?.body))).toEqual({ applicationKey: 'app-key-12345678', applicationSecret: 'app-secret-12345678' });

    const [createUrl, createInit] = fetchMock.mock.calls[1];
    expect(String(createUrl)).toBe('https://api-sandbox.partners.scb/partners/sandbox/v3/deeplink/transactions');
    const headers = createInit?.headers as Record<string, string>;
    expect(headers.authorization).toBe('Bearer tok-1');
    expect(headers.resourceOwnerId).toBe('app-key-12345678');
    const body = JSON.parse(String(createInit?.body));
    expect(body.transactionType).toBe('PURCHASE');
    expect(body.transactionSubType).toEqual(['BP']);
    expect(body.billPayment.paymentAmount).toBe(150.5);
    expect(body.billPayment.accountTo).toBe('012345678901234');
    expect(body.billPayment.ref1).toBe('ABCDEFGH23456789');
    expect(body.billPayment.ref2).toBe('Q001');
    expect(body.merchantMetaData.callbackUrl).toContain('/pay/return');
  });

  it('reuses a cached token for the same cache key', async () => {
    queueToken();
    fetchMock.mockResolvedValueOnce(jsonResponse({ status: { code: 1000 }, data: { transactionId: 'T1', deeplinkUrl: 'https://x' } }));
    fetchMock.mockResolvedValueOnce(jsonResponse({ status: { code: 1000 }, data: { transactionId: 'T2', deeplinkUrl: 'https://y' } }));
    const input = { amountTHB: 10, ref1: 'REF1', ref2: 'Q1', description: 'd', sessionMinutes: 5, returnUrl: 'https://r', merchantName: 'm', cacheKey: 'k' };
    await scbAdapter.createTransaction(config, input);
    await scbAdapter.createTransaction(config, input);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('throws a DeeplinkProviderError without leaking the bank body', async () => {
    queueToken();
    fetchMock.mockResolvedValueOnce(jsonResponse({ status: { code: 9500, description: 'secret detail xyz' } }, 400));
    const input = { amountTHB: 10, ref1: 'REF1', ref2: 'Q1', description: 'd', sessionMinutes: 5, returnUrl: 'https://r', merchantName: 'm', cacheKey: 'k2' };
    await expect(scbAdapter.createTransaction(config, input)).rejects.toSatisfy((e: unknown) => {
      return e instanceof DeeplinkProviderError && e.code === 'scb_create_failed' && !e.message.includes('xyz');
    });
  });

  it('fails authorization cleanly when the token call is rejected', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ status: { code: 9100 } }, 401));
    await expect(scbAdapter.authorize(config, 'k3')).rejects.toMatchObject({ code: 'scb_auth_failed', httpStatus: 401 });
  });
});

describe('scbAdapter.inquireTransaction', () => {
  it('maps a successful inquiry with amount and timestamp', async () => {
    queueToken();
    fetchMock.mockResolvedValueOnce(jsonResponse({
      status: { code: 1000 },
      data: { transactionId: 'TXN-1', transactionStatus: 'SUCCESS', amount: '150.50', transactionDateandTime: '2026-09-10T10:00:00+07:00' },
    }));
    const r = await scbAdapter.inquireTransaction(config, { transactionId: 'TXN-1', ref1: 'REF' }, 'k4');
    expect(r).toMatchObject({ transactionId: 'TXN-1', status: 'paid', amountTHB: 150.5, paidAt: '2026-09-10T10:00:00+07:00' });
    expect(String(fetchMock.mock.calls[1][0])).toBe('https://api-sandbox.partners.scb/partners/sandbox/v2/transactions/TXN-1');
  });

  it.each([
    ['FAILED', 'failed'],
    ['EXPIRED', 'expired'],
    ['PENDING', 'pending'],
    ['SOMETHING_NEW', 'pending'],
  ])('maps %s to %s', async (bankStatus, expected) => {
    queueToken();
    fetchMock.mockResolvedValueOnce(jsonResponse({ status: { code: 1000 }, data: { transactionId: 'T', transactionStatus: bankStatus } }));
    const r = await scbAdapter.inquireTransaction(config, { transactionId: 'T', ref1: null }, `k-${bankStatus}`);
    expect(r.status).toBe(expected);
    expect(r.amountTHB).toBeNull();
  });

  it('refuses to inquire without a transaction id', async () => {
    await expect(scbAdapter.inquireTransaction(config, { transactionId: null, ref1: 'REF' }, 'k5')).rejects.toMatchObject({ code: 'scb_inquiry_missing_id' });
  });
});

describe('scbAdapter.parseConfirmation', () => {
  it('accepts string or numeric amounts and locates by transactionId or ref1', () => {
    expect(scbAdapter.parseConfirmation({ transactionId: 'T1', amount: '99.00', billPaymentRef1: 'REF1' })).toEqual({
      transactionId: 'T1', ref1: 'REF1', amountTHB: 99, paidAt: null,
    });
    expect(scbAdapter.parseConfirmation({ billPaymentRef1: 'REF2', amount: 20, transactionDateandTime: '2026-01-01T00:00:00+07:00' })).toEqual({
      transactionId: null, ref1: 'REF2', amountTHB: 20, paidAt: '2026-01-01T00:00:00+07:00',
    });
  });

  it('rejects bodies with nothing to look a booking up by', () => {
    expect(scbAdapter.parseConfirmation({ amount: 10 })).toBeNull();
    expect(scbAdapter.parseConfirmation('nope')).toBeNull();
    expect(scbAdapter.parseConfirmation(null)).toBeNull();
  });
});

describe('toScbRef', () => {
  it('upper-cases, strips symbols and truncates to 20', () => {
    expect(toScbRef('q-001 ก')).toBe('Q001');
    expect(toScbRef('a'.repeat(30))).toHaveLength(20);
  });
});
