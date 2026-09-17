import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { OmiseCharge } from './omise';

const retrieve = vi.fn<(...args: unknown[]) => Promise<OmiseCharge>>();
const pushReceipt = vi.fn(async () => true);
const notify = vi.fn(async () => null);

vi.mock('./omise', () => ({
  retrieveCharge: (...args: unknown[]) => retrieve(...args),
  resolveOmiseSecretKey: (k: string | null) => k || '',
}));
vi.mock('@/lib/payments/receipt', () => ({ pushPaymentReceipt: (...args: unknown[]) => pushReceipt(...(args as [])) }));
vi.mock('@/lib/notifications/createNotification', () => ({ safeCreateNotification: (...args: unknown[]) => notify(...(args as [])) }));

import { confirmOmiseCharge, omiseReceiptRef } from './omise-confirm';

type Row = Record<string, unknown>;

/** Minimal supabase builder: select/update/insert + eq + maybeSingle over in-memory tables. */
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

function bookingRow(overrides: Row = {}): Row {
  return {
    id: 'b1', shop_id: 'shop1', company_id: 'c1', queue_number: 'A001',
    payment_status: 'pending_payment', payment_method: 'omise_mobile_banking', payment_amount: 150.5,
    omise_charge_id: 'chrg_test_1', bank_provider: 'kbank',
    shops: { omise_secret_key: 'skey_test_x' },
    ...overrides,
  };
}

function charge(overrides: Partial<OmiseCharge> = {}): OmiseCharge {
  return { id: 'chrg_test_1', status: 'successful', amount: 15050, currency: 'THB', expires_at: null, paid_at: '2026-09-15T03:00:00Z', ...overrides };
}

beforeEach(() => {
  retrieve.mockReset();
  pushReceipt.mockClear();
  notify.mockClear();
});

describe('confirmOmiseCharge', () => {
  it('marks a successful charge paid exactly once and sends one receipt', async () => {
    const tables = { bookings: [bookingRow()], payment_transactions: [] as Row[] };
    retrieve.mockResolvedValue(charge());
    const admin = fakeAdmin(tables);

    expect(await confirmOmiseCharge(admin, { shopId: 'shop1', bookingId: 'b1' })).toBe('paid');
    expect(tables.bookings[0]).toMatchObject({ payment_status: 'paid', paid_at: '2026-09-15T03:00:00Z', payment_verified_at: '2026-09-15T03:00:00Z' });
    expect(tables.payment_transactions).toHaveLength(1);
    expect(tables.payment_transactions[0]).toMatchObject({ event_type: 'charge.complete', status: 'successful', omise_charge_id: 'chrg_test_1', provider: 'kbank', method: 'omise_mobile_banking' });
    expect(pushReceipt).toHaveBeenCalledTimes(1);
    expect(pushReceipt).toHaveBeenCalledWith(admin, expect.objectContaining({ receiptRef: 'RCP-TEST_1' }));

    expect(await confirmOmiseCharge(admin, { shopId: 'shop1', bookingId: 'b1' })).toBe('already_paid');
    expect(pushReceipt).toHaveBeenCalledTimes(1);
    expect(retrieve).toHaveBeenCalledTimes(1);
  });

  it('also works for the PromptPay QR method (webhook delegates here)', async () => {
    const tables = { bookings: [bookingRow({ payment_method: 'omise_promptpay', bank_provider: null })], payment_transactions: [] as Row[] };
    retrieve.mockResolvedValue(charge());
    expect(await confirmOmiseCharge(fakeAdmin(tables), { shopId: 'shop1', bookingId: 'b1' })).toBe('paid');
  });

  it('refuses to mark paid when the charged amount differs, and alerts the shop', async () => {
    const tables = { bookings: [bookingRow()], payment_transactions: [] as Row[] };
    retrieve.mockResolvedValue(charge({ amount: 10000 }));

    expect(await confirmOmiseCharge(fakeAdmin(tables), { shopId: 'shop1', bookingId: 'b1' })).toBe('amount_mismatch');
    expect(tables.bookings[0].payment_status).toBe('pending_payment');
    expect(tables.payment_transactions[0]).toMatchObject({ event_type: 'charge.amount_mismatch', status: 'mismatch' });
    expect(notify).toHaveBeenCalledTimes(1);
    expect(pushReceipt).not.toHaveBeenCalled();
  });

  it('leaves the booking pending while Omise still says pending', async () => {
    const tables = { bookings: [bookingRow()], payment_transactions: [] as Row[] };
    retrieve.mockResolvedValue(charge({ status: 'pending', paid_at: null }));
    expect(await confirmOmiseCharge(fakeAdmin(tables), { shopId: 'shop1', bookingId: 'b1' })).toBe('still_pending');
    expect(tables.bookings[0].payment_status).toBe('pending_payment');
    expect(tables.payment_transactions).toHaveLength(0);
  });

  it('marks the booking failed when the customer cancels in the bank app', async () => {
    const tables = { bookings: [bookingRow()], payment_transactions: [] as Row[] };
    retrieve.mockResolvedValue(charge({ status: 'failed', paid_at: null, failure_code: 'payment_cancelled', failure_message: 'Payment cancelled' }));
    expect(await confirmOmiseCharge(fakeAdmin(tables), { shopId: 'shop1', bookingId: 'b1' })).toBe('failed');
    expect(tables.bookings[0].payment_status).toBe('failed');
    expect(tables.payment_transactions[0]).toMatchObject({ event_type: 'charge.failed', note: 'payment_cancelled: Payment cancelled' });
    expect(pushReceipt).not.toHaveBeenCalled();
  });

  it('keeps an expired charge pending so the customer can re-issue', async () => {
    const tables = { bookings: [bookingRow()], payment_transactions: [] as Row[] };
    retrieve.mockResolvedValue(charge({ status: 'expired', paid_at: null }));
    expect(await confirmOmiseCharge(fakeAdmin(tables), { shopId: 'shop1', bookingId: 'b1' })).toBe('expired');
    expect(tables.bookings[0].payment_status).toBe('pending_payment');
    expect(tables.payment_transactions[0]).toMatchObject({ event_type: 'charge.expired' });
  });

  it('ignores bookings that are not Omise charges', async () => {
    const tables = { bookings: [bookingRow({ payment_method: 'bank_deeplink', omise_charge_id: null })], payment_transactions: [] as Row[] };
    expect(await confirmOmiseCharge(fakeAdmin(tables), { shopId: 'shop1', bookingId: 'b1' })).toBe('not_found');
    expect(retrieve).not.toHaveBeenCalled();
  });

  it('reports provider_error when Omise is unreachable', async () => {
    const tables = { bookings: [bookingRow()], payment_transactions: [] as Row[] };
    retrieve.mockRejectedValue(new Error('network'));
    expect(await confirmOmiseCharge(fakeAdmin(tables), { shopId: 'shop1', bookingId: 'b1' })).toBe('provider_error');
  });
});

describe('omiseReceiptRef', () => {
  it('derives a stable receipt reference from the charge id', () => {
    expect(omiseReceiptRef('chrg_test_5abc')).toBe('RCP-TEST_5ABC');
  });
});
