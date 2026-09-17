import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { DeeplinkProviderConfig, InquiryResult } from './types';

const inquire = vi.fn<(...args: unknown[]) => Promise<InquiryResult>>();
const pushReceipt = vi.fn(async () => true);
const notify = vi.fn(async () => null);
const loadProvider = vi.fn<(...args: unknown[]) => Promise<DeeplinkProviderConfig | null>>();

vi.mock('./registry', () => ({
  getDeeplinkAdapter: () => ({ provider: 'scb', displayName: 'SCB Easy', inquireTransaction: inquire }),
  parseBankProvider: (v: unknown) => (v === 'scb' || v === 'kbank' ? v : null),
}));
vi.mock('./settings', () => ({
  loadShopDeeplinkProvider: (...args: unknown[]) => loadProvider(...args),
  providerCacheKey: () => 'cache',
}));
vi.mock('@/lib/payments/receipt', () => ({ pushPaymentReceipt: (...args: unknown[]) => pushReceipt(...(args as [])) }));
vi.mock('@/lib/notifications/createNotification', () => ({ safeCreateNotification: (...args: unknown[]) => notify(...(args as [])) }));

import { confirmDeeplinkPayment } from './confirm';

type Row = Record<string, unknown>;

/**
 * Just enough of the supabase query builder for confirm.ts: select/update/insert
 * with eq filters, maybeSingle, and thenable execution against in-memory tables.
 */
function fakeAdmin(tables: Record<string, Row[]>) {
  function builder(table: string) {
    const filters: Array<[string, unknown]> = [];
    let op: 'select' | 'update' | 'insert' = 'select';
    let patch: Row = {};
    let single = false;

    const matches = (row: Row) => filters.every(([k, v]) => row[k] === v);
    const run = async () => {
      const rows = tables[table] ?? (tables[table] = []);
      if (op === 'insert') {
        rows.push(patch);
        return { data: [patch], error: null };
      }
      const hit = rows.filter(matches);
      if (op === 'update') hit.forEach((r) => Object.assign(r, patch));
      const data = single ? (hit[0] ?? null) : hit.map((r) => ({ ...r }));
      return { data, error: null };
    };

    const api = {
      select() { return api; },
      update(p: Row) { op = 'update'; patch = p; return api; },
      insert(p: Row) { op = 'insert'; patch = p; return api; },
      eq(k: string, v: unknown) { filters.push([k, v]); return api; },
      maybeSingle() { single = true; return api; },
      then<T>(resolve: (v: { data: unknown; error: null }) => T) { return run().then(resolve); },
    };
    return api;
  }
  return { from: builder } as unknown as SupabaseClient;
}

const config: DeeplinkProviderConfig = {
  id: 'p1', provider: 'scb', environment: 'sandbox', billerId: '0', merchantName: null, sessionMinutes: 15, webhookSecret: 's', credentials: {},
};

function bookingRow(overrides: Row = {}): Row {
  return {
    id: 'b1', shop_id: 'shop1', company_id: 'c1', queue_number: 'A001',
    payment_status: 'pending_payment', payment_method: 'bank_deeplink', payment_amount: 150.5,
    bank_provider: 'scb', bank_txn_id: 'TXN1', bank_txn_ref: 'REFREFREFREFREF1',
    ...overrides,
  };
}

function paidInquiry(amount: number | null): InquiryResult {
  return { transactionId: 'TXN1', status: 'paid', amountTHB: amount, paidAt: '2026-09-10T03:00:00Z', raw: {} };
}

beforeEach(() => {
  inquire.mockReset();
  pushReceipt.mockClear();
  notify.mockClear();
  loadProvider.mockReset();
  loadProvider.mockResolvedValue(config);
});

describe('confirmDeeplinkPayment', () => {
  it('marks a bank-confirmed payment paid exactly once and sends one receipt', async () => {
    const tables = { bookings: [bookingRow()], payment_transactions: [] as Row[] };
    inquire.mockResolvedValue(paidInquiry(150.5));
    const admin = fakeAdmin(tables);

    expect(await confirmDeeplinkPayment(admin, { shopId: 'shop1', bookingId: 'b1' })).toBe('paid');
    expect(tables.bookings[0]).toMatchObject({ payment_status: 'paid', paid_at: '2026-09-10T03:00:00Z' });
    expect(tables.payment_transactions).toHaveLength(1);
    expect(tables.payment_transactions[0]).toMatchObject({ event_type: 'deeplink.confirmed', provider: 'scb', provider_txn_id: 'TXN1', shop_id: 'shop1' });
    expect(pushReceipt).toHaveBeenCalledTimes(1);

    // A second confirmation (bank retry) is a no-op.
    expect(await confirmDeeplinkPayment(admin, { shopId: 'shop1', bookingId: 'b1' })).toBe('already_paid');
    expect(pushReceipt).toHaveBeenCalledTimes(1);
    expect(inquire).toHaveBeenCalledTimes(1);
  });

  it('refuses to mark paid when the bank amount differs, and alerts the shop', async () => {
    const tables = { bookings: [bookingRow()], payment_transactions: [] as Row[] };
    inquire.mockResolvedValue(paidInquiry(100));

    expect(await confirmDeeplinkPayment(fakeAdmin(tables), { shopId: 'shop1', bookingId: 'b1' })).toBe('amount_mismatch');
    expect(tables.bookings[0].payment_status).toBe('pending_payment');
    expect(tables.payment_transactions[0]).toMatchObject({ event_type: 'deeplink.amount_mismatch', status: 'mismatch' });
    expect(notify).toHaveBeenCalledTimes(1);
    expect(pushReceipt).not.toHaveBeenCalled();
  });

  it('accepts a paid inquiry that does not echo the amount', async () => {
    const tables = { bookings: [bookingRow()], payment_transactions: [] as Row[] };
    inquire.mockResolvedValue(paidInquiry(null));
    expect(await confirmDeeplinkPayment(fakeAdmin(tables), { shopId: 'shop1', bookingId: 'b1' })).toBe('paid');
  });

  it('leaves a pending transaction untouched', async () => {
    const tables = { bookings: [bookingRow()], payment_transactions: [] as Row[] };
    inquire.mockResolvedValue({ ...paidInquiry(150.5), status: 'pending' });
    expect(await confirmDeeplinkPayment(fakeAdmin(tables), { shopId: 'shop1', bookingId: 'b1' })).toBe('still_pending');
    expect(tables.payment_transactions).toHaveLength(0);
    expect(tables.bookings[0].payment_status).toBe('pending_payment');
  });

  it('records a failed transaction and marks the booking failed; expiry keeps it payable', async () => {
    const failed = { bookings: [bookingRow()], payment_transactions: [] as Row[] };
    inquire.mockResolvedValue({ ...paidInquiry(null), status: 'failed' });
    expect(await confirmDeeplinkPayment(fakeAdmin(failed), { shopId: 'shop1', bookingId: 'b1' })).toBe('failed');
    expect(failed.bookings[0].payment_status).toBe('failed');
    expect(failed.payment_transactions[0]).toMatchObject({ event_type: 'deeplink.failed' });

    const expired = { bookings: [bookingRow()], payment_transactions: [] as Row[] };
    inquire.mockResolvedValue({ ...paidInquiry(null), status: 'expired' });
    expect(await confirmDeeplinkPayment(fakeAdmin(expired), { shopId: 'shop1', bookingId: 'b1' })).toBe('expired');
    expect(expired.bookings[0].payment_status).toBe('pending_payment');
  });

  it('never confirms across tenants or for other payment methods', async () => {
    const tables = { bookings: [bookingRow()], payment_transactions: [] as Row[] };
    inquire.mockResolvedValue(paidInquiry(150.5));
    expect(await confirmDeeplinkPayment(fakeAdmin(tables), { shopId: 'other-shop', bookingId: 'b1' })).toBe('not_found');

    const transfer = { bookings: [bookingRow({ payment_method: 'bank_transfer' })], payment_transactions: [] as Row[] };
    expect(await confirmDeeplinkPayment(fakeAdmin(transfer), { shopId: 'shop1', bookingId: 'b1' })).toBe('not_found');
    expect(inquire).not.toHaveBeenCalled();
  });

  it('reports provider errors without changing anything', async () => {
    const tables = { bookings: [bookingRow()], payment_transactions: [] as Row[] };
    inquire.mockRejectedValue(new Error('bank down'));
    expect(await confirmDeeplinkPayment(fakeAdmin(tables), { shopId: 'shop1', bookingId: 'b1' })).toBe('provider_error');
    expect(tables.bookings[0].payment_status).toBe('pending_payment');

    loadProvider.mockResolvedValue(null);
    expect(await confirmDeeplinkPayment(fakeAdmin(tables), { shopId: 'shop1', bookingId: 'b1' })).toBe('provider_error');
  });
});
