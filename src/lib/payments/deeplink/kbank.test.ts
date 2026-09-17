import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { kbankAdapter, kbankRequestDt, toKbankRef } from './kbank';
import { clearTokenCache, type DeeplinkProviderConfig } from './types';

const config: DeeplinkProviderConfig = {
  id: 'row-2',
  provider: 'kbank',
  environment: 'sandbox',
  billerId: 'KB-MERCHANT-1',
  merchantName: null,
  sessionMinutes: 10,
  webhookSecret: 'whsec',
  credentials: { consumerId: 'consumer-1234', consumerSecret: 'consumer-secret', partnerId: 'PTR001', partnerSecret: 'ptr-secret' },
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

afterEach(() => vi.unstubAllGlobals());

function queueToken() {
  fetchMock.mockResolvedValueOnce(jsonResponse({ access_token: 'kb-tok', expires_in: 1799 }));
}

describe('kbankAdapter', () => {
  it('uses Basic auth for the token and the partner envelope for create', async () => {
    queueToken();
    fetchMock.mockResolvedValueOnce(jsonResponse({ statusCode: '00', txnNo: 'KB-TXN-1', deeplinkUrl: 'https://kplus.example/pay/1' }));

    const r = await kbankAdapter.createTransaction(config, {
      amountTHB: 200,
      ref1: 'ABCDEFGH23456789',
      ref2: 'Q-7',
      description: 'ร้าน Q-7',
      sessionMinutes: 10,
      returnUrl: 'https://app.example/return',
      merchantName: 'ร้าน',
      cacheKey: 'kbank:row-2:sandbox',
    });
    expect(r).toMatchObject({ transactionId: 'KB-TXN-1', deeplinkUrl: 'https://kplus.example/pay/1' });
    expect(r.raw).not.toHaveProperty('deeplinkUrl');

    const [, tokenInit] = fetchMock.mock.calls[0];
    const tokenHeaders = tokenInit?.headers as Record<string, string>;
    expect(tokenHeaders.Authorization).toBe(`Basic ${Buffer.from('consumer-1234:consumer-secret').toString('base64')}`);
    expect(tokenHeaders['x-test-mode']).toBe('true');
    expect(String(tokenInit?.body)).toBe('grant_type=client_credentials');

    const [createUrl, createInit] = fetchMock.mock.calls[1];
    expect(String(createUrl)).toBe('https://openapi-sandbox.kasikornbank.com/v1/paywithkplus/request');
    const body = JSON.parse(String(createInit?.body));
    expect(body).toMatchObject({ partnerTxnUid: 'ABCDEFGH23456789', partnerId: 'PTR001', partnerSecret: 'ptr-secret', merchantId: 'KB-MERCHANT-1', txnAmount: 200, txnCurrencyCode: 'THB', reference2: 'Q7' });
    expect(body.requestDt).toMatch(/\+07:00$/);
  });

  it('inquires by the original partner reference and maps statuses', async () => {
    queueToken();
    fetchMock.mockResolvedValueOnce(jsonResponse({ statusCode: '00', txnNo: 'KB-TXN-1', txnStatus: 'PAID', txnAmount: '200.00', paidDt: '2026-09-10T10:00:00+07:00' }));
    const r = await kbankAdapter.inquireTransaction(config, { transactionId: null, ref1: 'ABCDEFGH23456789' }, 'k1');
    expect(r).toMatchObject({ transactionId: 'KB-TXN-1', status: 'paid', amountTHB: 200 });
    const body = JSON.parse(String(fetchMock.mock.calls[1][1]?.body));
    expect(body.origPartnerTxnUid).toBe('ABCDEFGH23456789');
    expect(body.partnerTxnUid).not.toBe('ABCDEFGH23456789');
  });

  it('treats a non-00 statusCode as a provider error', async () => {
    queueToken();
    fetchMock.mockResolvedValueOnce(jsonResponse({ statusCode: '10', statusMessage: 'internal secret' }));
    await expect(kbankAdapter.inquireTransaction(config, { transactionId: null, ref1: 'REF' }, 'k2')).rejects.toMatchObject({ code: 'kbank_inquiry_failed' });
  });

  it('parses notifications and ignores unrelated bodies', () => {
    expect(kbankAdapter.parseConfirmation({ partnerTxnUid: 'REF9', txnNo: 'N1', txnAmount: 55, txnStatus: 'PAID' })).toEqual({
      transactionId: 'N1', ref1: 'REF9', amountTHB: 55, paidAt: null,
    });
    expect(kbankAdapter.parseConfirmation({ hello: 'world' })).toBeNull();
    expect(kbankAdapter.confirmationResponse(null)).toEqual({ statusCode: '00', statusMessage: 'success' });
  });

  it('formats references and request timestamps', () => {
    expect(toKbankRef('q-7 ก')).toBe('q7');
    expect(kbankRequestDt(new Date('2026-09-10T03:04:05Z'))).toBe('2026-09-10T10:04:05+07:00');
  });
});
