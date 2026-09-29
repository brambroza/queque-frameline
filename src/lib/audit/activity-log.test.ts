import { beforeEach, describe, expect, it, vi } from 'vitest';

const insert = vi.fn();
const from = vi.fn(() => ({ insert }));
const createAdminClient = vi.fn(() => ({ from }));

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => createAdminClient() }));

import { logCrud, sanitizeAuditPayload, toAuditTargetId } from './activity-log';

const ACTOR = { user: { id: 'user-1' }, profile: { company_id: 'company-1', shop_id: 'shop-1' } };
const UUID = '3f2b8c1e-5d4a-4e7b-9a10-2c6f1d0e8b77';

beforeEach(() => {
  insert.mockReset();
  insert.mockResolvedValue({ error: null });
  from.mockClear();
  createAdminClient.mockClear();
});

describe('sanitizeAuditPayload', () => {
  it('masks secret-looking string values', () => {
    expect(
      sanitizeAuditPayload({
        channel_access_token: 'abc',
        channel_secret: 'def',
        password: 'p',
        raw_key: 'flq_x',
        image_base64: 'iVBOR',
        liff_id: '1234567890-abcdefgh',
      }),
    ).toEqual({
      channel_access_token: '[redacted]',
      channel_secret: '[redacted]',
      password: '[redacted]',
      raw_key: '[redacted]',
      image_base64: '[redacted]',
      liff_id: '1234567890-abcdefgh',
    });
  });

  it('keeps numbers, booleans and null under secret-looking keys', () => {
    expect(sanitizeAuditPayload({ booking_token_ttl_days: 14, has_token: true, channel_secret: null })).toEqual({
      booking_token_ttl_days: 14,
      has_token: true,
      channel_secret: null,
    });
  });

  it('masks secrets nested inside objects and arrays', () => {
    expect(sanitizeAuditPayload({ items: [{ name: 'a', api_key: 'k' }] })).toEqual({
      items: [{ name: 'a', api_key: '[redacted]' }],
    });
  });

  it('cuts long strings and caps array length', () => {
    const out = sanitizeAuditPayload({ note: 'x'.repeat(600), list: Array.from({ length: 80 }, (_, i) => i) }) as {
      note: string;
      list: number[];
    };
    expect(out.note).toHaveLength(501);
    expect(out.note.endsWith('…')).toBe(true);
    expect(out.list).toHaveLength(50);
  });

  it('stops at the depth cap', () => {
    expect(sanitizeAuditPayload({ a: { b: { c: { d: { e: 1 } } } } })).toEqual({ a: { b: { c: { d: '[truncated]' } } } });
  });

  it('turns undefined into null', () => {
    expect(sanitizeAuditPayload({ a: undefined })).toEqual({ a: null });
  });
});

describe('toAuditTargetId', () => {
  it('accepts a uuid', () => {
    expect(toAuditTargetId(UUID)).toBe(UUID);
  });

  it('refuses anything else', () => {
    expect(toAuditTargetId('not-a-uuid')).toBeNull();
    expect(toAuditTargetId('')).toBeNull();
    expect(toAuditTargetId(null)).toBeNull();
    expect(toAuditTargetId(undefined)).toBeNull();
    expect(toAuditTargetId(42)).toBeNull();
  });
});

describe('logCrud', () => {
  it('writes one row per operation with the matching action', async () => {
    await logCrud(ACTOR, 'create', 'holidays', UUID, { reason: 'ปีใหม่' });
    await logCrud(ACTOR, 'update', 'holidays', UUID, { reason: 'แก้ไข' });
    await logCrud(ACTOR, 'delete', 'holidays', UUID, { soft_delete: true });

    expect(from).toHaveBeenCalledWith('activity_logs');
    expect(insert.mock.calls.map((call) => call[0].action)).toEqual(['data_created', 'data_updated', 'data_deleted']);
    expect(insert.mock.calls[0][0]).toMatchObject({
      company_id: 'company-1',
      shop_id: 'shop-1',
      user_id: 'user-1',
      target_table: 'holidays',
      target_id: UUID,
      payload: { reason: 'ปีใหม่' },
      created_by: 'user-1',
    });
  });

  it('keeps a non-uuid id in the payload instead of the uuid column', async () => {
    await logCrud(ACTOR, 'update', 'settings', 'theme_color', { key: 'theme_color' });
    expect(insert.mock.calls[0][0]).toMatchObject({ target_id: null, payload: { key: 'theme_color', ref: 'theme_color' } });
  });

  it('logs without an id or payload', async () => {
    await logCrud(ACTOR, 'create', 'external_documents', null);
    expect(insert.mock.calls[0][0]).toMatchObject({ target_id: null, payload: {} });
  });

  it('never stores a secret handed in by a route', async () => {
    await logCrud(ACTOR, 'update', 'line_config', UUID, { channel_access_token: 'real-token', notify_driver: true });
    expect(insert.mock.calls[0][0].payload).toEqual({ channel_access_token: '[redacted]', notify_driver: true });
  });

  it('does not throw when the insert fails', async () => {
    insert.mockRejectedValueOnce(new Error('db down'));
    await expect(logCrud(ACTOR, 'delete', 'branches', UUID)).resolves.toBeUndefined();
  });

  it('does not throw when the admin client cannot be created', async () => {
    createAdminClient.mockImplementationOnce(() => {
      throw new Error('missing service role key');
    });
    await expect(logCrud(ACTOR, 'create', 'branches', UUID)).resolves.toBeUndefined();
  });
});
