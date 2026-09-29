import { describe, expect, it } from 'vitest';
import { actionsOfOp, knownActions, opOfAction, parseActivityFilters, summarizePayload, tableLabel } from './activity-view';

const UUID = '3f2b8c1e-5d4a-4e7b-9a10-2c6f1d0e8b77';
const parse = (query: string) => parseActivityFilters(new URLSearchParams(query));

describe('opOfAction', () => {
  it('maps generic and named actions', () => {
    expect(opOfAction('data_created')).toBe('create');
    expect(opOfAction('data_updated')).toBe('update');
    expect(opOfAction('data_deleted')).toBe('delete');
    expect(opOfAction('role_updated')).toBe('update');
    expect(opOfAction('api_key_revoked')).toBe('delete');
  });

  it('falls back to other', () => {
    expect(opOfAction('something_else')).toBe('other');
    expect(opOfAction(null)).toBe('other');
    expect(opOfAction(undefined)).toBe('other');
  });
});

describe('actionsOfOp', () => {
  it('lists every action of an operation', () => {
    expect(actionsOfOp('create')).toEqual(expect.arrayContaining(['data_created', 'role_created', 'api_key_created', 'feedback_submitted']));
    expect(actionsOfOp('delete')).toEqual(expect.arrayContaining(['data_deleted', 'role_deleted', 'api_key_revoked']));
  });

  it('only returns actions that map back to the same operation', () => {
    for (const op of ['create', 'update', 'delete'] as const) {
      for (const action of actionsOfOp(op)) expect(opOfAction(action)).toBe(op);
    }
  });

  it('covers every known action between the three operations', () => {
    const all = [...actionsOfOp('create'), ...actionsOfOp('update'), ...actionsOfOp('delete')].sort();
    expect(all).toEqual(knownActions().sort());
  });
});

describe('tableLabel', () => {
  it('names known tables', () => {
    expect(tableLabel('bookings')).toBe('คิวรับ-ส่งสินค้า');
    expect(tableLabel('customers')).toBe('คู่ค้า');
  });

  it('keeps unknown names and handles empty', () => {
    expect(tableLabel('mystery_table')).toBe('mystery_table');
    expect(tableLabel(null)).toBe('-');
    expect(tableLabel('')).toBe('-');
  });
});

describe('parseActivityFilters', () => {
  it('defaults to page 1, 20 rows, no filters', () => {
    expect(parse('')).toEqual({ op: null, table: null, userId: null, from: null, to: null, page: 1, pageSize: 20 });
  });

  it('reads valid filters', () => {
    expect(parse(`op=delete&table=bookings&user_id=${UUID}&page=3&page_size=50`)).toMatchObject({
      op: 'delete',
      table: 'bookings',
      userId: UUID,
      page: 3,
      pageSize: 50,
    });
  });

  it('turns days into Bangkok day boundaries', () => {
    expect(parse('from=2026-09-01&to=2026-09-29')).toMatchObject({
      from: '2026-09-01T00:00:00+07:00',
      to: '2026-09-29T23:59:59.999+07:00',
    });
  });

  it('swaps a reversed range', () => {
    expect(parse('from=2026-09-29&to=2026-09-01')).toMatchObject({
      from: '2026-09-01T00:00:00+07:00',
      to: '2026-09-29T23:59:59.999+07:00',
    });
  });

  it('drops malformed values', () => {
    expect(parse('op=drop&table=bookings;delete&user_id=abc&from=2026-13-40&to=yesterday')).toMatchObject({
      op: null,
      table: null,
      userId: null,
      from: null,
      to: null,
    });
  });

  it('drops filter-injection attempts in the table name', () => {
    expect(parse('table=a,b').table).toBeNull();
    expect(parse('table=a.b').table).toBeNull();
    expect(parse('table=A').table).toBeNull();
    expect(parse(`table=${'a'.repeat(61)}`).table).toBeNull();
  });

  it('clamps paging', () => {
    expect(parse('page=0&page_size=0')).toMatchObject({ page: 1, pageSize: 20 });
    expect(parse('page=-4&page_size=9999')).toMatchObject({ page: 1, pageSize: 100 });
    expect(parse('page=2.9&page_size=abc')).toMatchObject({ page: 2, pageSize: 20 });
  });
});

describe('summarizePayload', () => {
  it('puts naming keys first without their key', () => {
    expect(summarizePayload({ active: true, branch_name: 'คลังบางนา' })).toBe('คลังบางนา · active: ใช่');
  });

  it('shows from → to pairs', () => {
    expect(summarizePayload({ queue_number: 'R-001', status: { from: 'pending', to: 'confirmed' } })).toBe('R-001 · status: pending → confirmed');
    expect(summarizePayload({ plate_number_actual: { from: null, to: '70-1234' } })).toBe('plate_number_actual: - → 70-1234');
  });

  it('skips noise, empty values and nested objects', () => {
    expect(summarizePayload({ soft_delete: true, ref: 'x', note: '', phone: null, extra: { a: 1 }, list: [] })).toBe('');
  });

  it('counts arrays and caps the number of parts', () => {
    expect(summarizePayload({ branch_ids: ['a', 'b'] })).toBe('branch_ids: 2 รายการ');
    expect(summarizePayload({ a: 1, b: 2, c: 3, d: 4, e: 5 }).split(' · ')).toHaveLength(4);
  });

  it('cuts long values', () => {
    const out = summarizePayload({ name: 'x'.repeat(80) });
    expect(out).toHaveLength(61);
    expect(out.endsWith('…')).toBe(true);
  });

  it('returns an empty string for anything that is not an object', () => {
    expect(summarizePayload(null)).toBe('');
    expect(summarizePayload('text')).toBe('');
    expect(summarizePayload([1, 2])).toBe('');
  });
});
