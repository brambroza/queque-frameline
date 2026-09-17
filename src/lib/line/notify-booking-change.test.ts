import { describe, expect, it, vi } from 'vitest';
import { safeNotifyBookingChange, type NotifyClient } from './notify-booking-change';

const SHOP = 'shop-1';
const BOOKING = 'booking-1';

type Row = Record<string, unknown> | null;

/**
 * Minimal chainable stub: every `from(table)` returns a builder whose terminal
 * `maybeSingle()` resolves to the row configured for that table. `update()` is
 * recorded so tests can assert what was written.
 */
function stubAdmin(rows: { bookings: Row; line_users: Row; shops: Row }) {
  const updates: Array<{ table: string; values: Record<string, unknown> }> = [];
  const builder = (table: keyof typeof rows) => {
    const chain: Record<string, unknown> = {};
    const self = () => chain;
    Object.assign(chain, {
      select: self,
      eq: self,
      maybeSingle: () => Promise.resolve({ data: rows[table] }),
      update: (values: Record<string, unknown>) => {
        updates.push({ table, values });
        return { eq: () => ({ eq: () => Promise.resolve({ error: null }) }) };
      },
    });
    return chain;
  };
  const admin = { from: (table: string) => builder(table as keyof typeof rows) } as unknown as NotifyClient;
  return { admin, updates };
}

const booking = {
  id: BOOKING,
  queue_number: 'A012',
  booking_date: '2026-09-15',
  start_time: '10:30:00',
  line_user_id: 'lu-1',
  resource_name: 'โค้ชบี',
  branches: { branch_name: 'สาขาหลัก' },
  services: { service_name: 'เทรนส่วนตัว' },
};

describe('safeNotifyBookingChange', () => {
  it('skips silently when the booking has no LINE user', async () => {
    const { admin, updates } = stubAdmin({ bookings: { ...booking, line_user_id: null }, line_users: null, shops: null });
    const push = vi.fn();
    const r = await safeNotifyBookingChange(
      { shopId: SHOP, bookingId: BOOKING, kind: 'moved', prev: { booking_date: '2026-09-14', start_time: '09:00:00' } },
      { admin, push },
    );
    expect(r).toEqual({ sent: false, reason: 'no_line_user' });
    expect(push).not.toHaveBeenCalled();
    expect(updates).toHaveLength(0);
  });

  it('pushes a change flex and stamps change_notified_at on a move', async () => {
    const { admin, updates } = stubAdmin({
      bookings: booking,
      line_users: { line_user_id: 'Uabc' },
      shops: { name: 'ฟิตเนสดี', shop_key: 'fit', line_channel_access_token: 'tok' },
    });
    const push = vi.fn().mockResolvedValue(undefined);
    const r = await safeNotifyBookingChange(
      { shopId: SHOP, bookingId: BOOKING, kind: 'moved', prev: { booking_date: '2026-09-14', start_time: '09:00:00', resource_name: 'โค้ชบี' }, resourceType: 'trainer' },
      { admin, push },
    );
    expect(r).toEqual({ sent: true });
    expect(push).toHaveBeenCalledTimes(1);
    const [token, to, messages] = push.mock.calls[0] as [string, string, Array<{ type: string; altText: string; contents: { footer: { contents: Array<{ action: { type: string; data?: string } }> } } }>];
    expect(token).toBe('tok');
    expect(to).toBe('Uabc');
    expect(messages[0].type).toBe('flex');
    expect(messages[0].altText).toContain('ร้านเลื่อนคิว');
    const ack = messages[0].contents.footer.contents[0].action;
    expect(ack.type).toBe('postback');
    expect(ack.data).toBe(`action=ack_change&booking_id=${BOOKING}`);
    expect(updates).toHaveLength(1);
    expect(updates[0].table).toBe('bookings');
    expect(updates[0].values).toHaveProperty('change_notified_at');
  });

  it('sends a cancel flex without stamping change_notified_at', async () => {
    const { admin, updates } = stubAdmin({
      bookings: booking,
      line_users: { line_user_id: 'Uabc' },
      shops: { name: 'ฟิตเนสดี', shop_key: 'fit', line_channel_access_token: 'tok' },
    });
    const push = vi.fn().mockResolvedValue(undefined);
    const r = await safeNotifyBookingChange(
      { shopId: SHOP, bookingId: BOOKING, kind: 'cancelled', prev: { booking_date: '2026-09-15', start_time: '10:30:00' } },
      { admin, push },
    );
    expect(r).toEqual({ sent: true });
    const [, , messages] = push.mock.calls[0] as [string, string, Array<{ altText: string }>];
    expect(messages[0].altText).toContain('ยกเลิกคิว');
    expect(updates).toHaveLength(0);
  });

  it('reports push failures without throwing', async () => {
    const { admin, updates } = stubAdmin({
      bookings: booking,
      line_users: { line_user_id: 'Uabc' },
      shops: { name: 'x', shop_key: 'x', line_channel_access_token: 'tok' },
    });
    const push = vi.fn().mockRejectedValue(new Error('LINE push failed: 429'));
    const r = await safeNotifyBookingChange(
      { shopId: SHOP, bookingId: BOOKING, kind: 'reassigned', prev: { booking_date: '2026-09-15', start_time: '10:30:00', resource_name: 'โค้ชเอ' } },
      { admin, push },
    );
    expect(r.sent).toBe(false);
    expect(r.reason).toBe('push_failed');
    expect(r.error).toContain('429');
    expect(updates).toHaveLength(0);
  });

  it('skips when the shop has no channel token', async () => {
    const prevEnv = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    delete process.env.LINE_CHANNEL_ACCESS_TOKEN;
    try {
      const { admin } = stubAdmin({ bookings: booking, line_users: { line_user_id: 'Uabc' }, shops: { name: 'x', shop_key: 'x', line_channel_access_token: null } });
      const push = vi.fn();
      const r = await safeNotifyBookingChange({ shopId: SHOP, bookingId: BOOKING, kind: 'moved', prev: { booking_date: '2026-09-14', start_time: '09:00:00' } }, { admin, push });
      expect(r).toEqual({ sent: false, reason: 'no_token' });
      expect(push).not.toHaveBeenCalled();
    } finally {
      if (prevEnv !== undefined) process.env.LINE_CHANNEL_ACCESS_TOKEN = prevEnv;
    }
  });
});
