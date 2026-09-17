import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMobileBankingCharge, createPromptPayCharge } from './omise';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function sentBody(): URLSearchParams {
  const [, init] = fetchMock.mock.calls[0];
  return init?.body as URLSearchParams;
}

describe('createMobileBankingCharge', () => {
  it('posts a mobile banking source with the amount in satang and the return uri', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: 'chrg_1', status: 'pending', amount: 15050, currency: 'THB', authorize_uri: 'https://pay.omise.co/x', expires_at: null, paid_at: null }));

    const charge = await createMobileBankingCharge({
      secretKey: 'skey_test_abc',
      amountTHB: 150.5,
      bank: 'kbank',
      returnUri: 'https://app.example/liff/shop/pay/return?booking_id=b1&t=tok',
      platformType: 'IOS',
      description: 'ร้านทดสอบ – Q-001',
      metadata: { booking_id: 'b1', shop_id: 's1' },
    });

    expect(charge.authorize_uri).toBe('https://pay.omise.co/x');
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe('https://api.omise.co/charges');
    expect(init?.method).toBe('POST');
    expect((init?.headers as Record<string, string>).Authorization).toBe('Basic ' + Buffer.from('skey_test_abc:').toString('base64'));
    const body = sentBody();
    expect(body.get('amount')).toBe('15050');
    expect(body.get('currency')).toBe('THB');
    expect(body.get('source[type]')).toBe('mobile_banking_kbank');
    expect(body.get('source[platform_type]')).toBe('IOS');
    expect(body.get('return_uri')).toBe('https://app.example/liff/shop/pay/return?booking_id=b1&t=tok');
    expect(body.get('metadata[booking_id]')).toBe('b1');
    expect(body.get('description')).toBe('ร้านทดสอบ – Q-001');
  });

  it('omits platform_type when unknown', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: 'chrg_2', status: 'pending', amount: 2000, currency: 'THB', expires_at: null, paid_at: null }));
    await createMobileBankingCharge({ secretKey: 'skey_test_abc', amountTHB: 20, bank: 'bay', returnUri: 'https://app.example/r', platformType: null });
    const body = sentBody();
    expect(body.get('source[type]')).toBe('mobile_banking_bay');
    expect(body.has('source[platform_type]')).toBe(false);
  });

  it('surfaces the Omise error code on failure', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ object: 'error', code: 'invalid_charge', message: 'source type not enabled' }, 400));
    await expect(
      createMobileBankingCharge({ secretKey: 'skey_test_abc', amountTHB: 20, bank: 'bbl', returnUri: 'https://app.example/r' }),
    ).rejects.toThrow('Omise error invalid_charge: source type not enabled');
  });
});

describe('createPromptPayCharge', () => {
  it('still posts an inline promptpay source without a return uri', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: 'chrg_3', status: 'pending', amount: 10000, currency: 'THB', expires_at: null, paid_at: null }));
    await createPromptPayCharge({ secretKey: 'skey_test_abc', amountTHB: 100 });
    const body = sentBody();
    expect(body.get('source[type]')).toBe('promptpay');
    expect(body.has('return_uri')).toBe(false);
  });
});
