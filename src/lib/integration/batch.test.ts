import { describe, expect, it } from 'vitest';
import { API_MAX_DOCUMENTS, MAX_LOGGED_FAILURES, formatZodIssues, normalizeApiItem, peekDocNo, summarizeBatch, type DocumentResult } from './batch';
import { apiDocumentUpsertSchema } from './schemas';

const axItem = {
  doc_no: 'SO-2026-000123',
  partner: { code: 'C00042', name: 'บริษัท ตัวอย่าง จำกัด', phone: '021234567', email: 'ap@example.co.th' },
  doc_date: '2026-09-22T00:00:00',
  due_date: '2026-09-25',
  branch: 'WH1',
  status: 'open',
  payment_status: 'เครดิต',
  remark: 'รับเองที่คลัง',
  erp_status: 'Backorder',
  ax: { SalesStatus: 1, InventLocationId: 'FG' },
  items: [
    { sku: 'FL-1001', name: 'Aluminium Louver 600x600', qty: 120, uom: 'PCS' },
    { sku: 'FL-1002', name: 'ระแนงอะลูมิเนียม', qty: '1,200', uom: 'PCS' },
  ],
};

describe('apiDocumentUpsertSchema', () => {
  it('parses an AX-shaped item, trims date-times and reads Thai payment words', () => {
    const r = apiDocumentUpsertSchema.safeParse(normalizeApiItem(axItem));
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.doc_date).toBe('2026-09-22');
    expect(r.data.payment_status).toBe('credit');
    expect(r.data.items[1]).toEqual({ sku: 'FL-1002', name: 'ระแนงอะลูมิเนียม', qty: 1200, uom: 'PCS' });
    expect((r.data as Record<string, unknown>).ax).toBeUndefined();
  });

  it('requires the partner code and the branch', () => {
    const noCode = apiDocumentUpsertSchema.safeParse({ ...axItem, partner: { name: 'x' } });
    expect(noCode.success).toBe(false);
    if (!noCode.success) expect(formatZodIssues(noCode.error).fields).toContain('partner.code');
    const noBranch = apiDocumentUpsertSchema.safeParse({ ...axItem, branch: '' });
    expect(noBranch.success).toBe(false);
    if (!noBranch.success) expect(formatZodIssues(noBranch.error).fields).toContain('branch');
  });

  it('rejects an unknown payment status', () => {
    const r = apiDocumentUpsertSchema.safeParse({ ...axItem, payment_status: 'half' });
    expect(r.success).toBe(false);
    if (!r.success) expect(formatZodIssues(r.error).fields).toContain('payment_status');
  });
});

describe('normalizeApiItem', () => {
  it('drops zero-quantity and nameless lines instead of failing the document', () => {
    const n = normalizeApiItem({ ...axItem, items: [{ name: 'A', qty: 0 }, { sku: 'S', qty: 2 }, { name: '', qty: 3 }, { name: 'B', qty: '5' }] }) as { items: unknown[] };
    expect(n.items).toEqual([{ sku: 'S', qty: 2, name: 'S' }, { name: 'B', qty: 5 }]);
  });

  it('drops a malformed partner email', () => {
    const n = normalizeApiItem({ ...axItem, partner: { code: 'C1', name: 'x', email: 'not-an-email' } }) as { partner: { email?: string } };
    expect(n.partner.email).toBeUndefined();
    expect(apiDocumentUpsertSchema.safeParse(n).success).toBe(true);
  });

  it('leaves non-objects alone', () => {
    expect(normalizeApiItem(null)).toBeNull();
    expect(normalizeApiItem('x')).toBe('x');
  });
});

describe('summarizeBatch', () => {
  const ok: DocumentResult = { doc_no: 'A', status: 'created', id: '1' };
  const up: DocumentResult = { doc_no: 'B', status: 'updated', id: '2' };
  const bad: DocumentResult = { doc_no: 'C', status: 'failed', code: 'unknown_branch', message: 'x' };

  it('counts and grades the batch', () => {
    expect(summarizeBatch([ok, up])).toMatchObject({ received: 2, created: 1, updated: 1, failed: 0, status: 'ok', failures: [] });
    expect(summarizeBatch([ok, bad])).toMatchObject({ received: 2, created: 1, failed: 1, status: 'partial', failures: [{ index: 1, doc_no: 'C', code: 'unknown_branch' }] });
    expect(summarizeBatch([bad, bad]).status).toBe('failed');
    expect(summarizeBatch([]).status).toBe('ok');
  });

  it('caps the stored failures', () => {
    const many = Array.from({ length: MAX_LOGGED_FAILURES + 10 }, () => bad);
    const s = summarizeBatch(many);
    expect(s.failed).toBe(MAX_LOGGED_FAILURES + 10);
    expect(s.failures).toHaveLength(MAX_LOGGED_FAILURES);
  });
});

describe('peekDocNo', () => {
  it('reads a doc_no off raw input for error rows', () => {
    expect(peekDocNo({ doc_no: ' SO-1 ' })).toBe('SO-1');
    expect(peekDocNo({})).toBeNull();
    expect(peekDocNo('x')).toBeNull();
  });
});

it('exposes the batch cap', () => {
  expect(API_MAX_DOCUMENTS).toBe(100);
});
