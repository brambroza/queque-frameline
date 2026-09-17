import { describe, expect, it, vi } from 'vitest';
import { safeNotifyBookingReminder, type ReminderClient } from './notify-booking-reminder';

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
  const admin = { from: (table: string) => builder(table as keyof typeof rows) } as unknown as ReminderClient;
  return { admin, updates };
}

const booking = {
  id: BOOKING,
  queue_number: 'A012',
  booking_date: '2026-09-15',
  start_time: '10:30:00',
  line_user_id: 'lu-1',
  reminder_sent_at: null,
  resource_name: 'โค้ชบี',
  branches: { branch_name: 'สาขาหลัก' },
  services: { service_name: 'เทรนส่วนตัว' },
};
const shop = { name: 'ฟิตเนสดี', shop_key: 'fit', line_channel_access_token: 'tok' };
const args = { shopId: SHOP, bookingId: BOOKING, minutesBefore: 30 };

describe('safeNotifyBookingReminder', () => {
  it('pushes a reminder flex and stamps reminder_sent_at', async () => {
    const { admin, updates } = stubAdmin({ bookings: booking, line_users: { line_user_id: 'Uabc' }, shops: shop });
    const push = vi.fn().mockResolvedValue(undefined);
    const r = await safeNotifyBookingReminder(args, { admin, push });
    expect(r).toEqual({ sent: true });
    const [token, to, messages] = push.mock.calls[0] as [string, string, Array<{ type: string; altText: string }>];
    expect(token).toBe('tok');
    expect(to).toBe('Uabc');
    expect(messages[0].type).toBe('flex');
    expect(messages[0].altText).toContain('30 นาที');
    expect(updates).toEqual([{ table: 'bookings', values: expect.objectContaining({ reminder_sent_at: expect.any(String) }) }]);
  });

  it('stamps without pushing when the booking has no LINE user', async () => {
    const { admin, updates } = stubAdmin({ bookings: { ...booking, line_user_id: null }, line_users: null, shops: shop });
    const push = vi.fn();
    const r = await safeNotifyBookingReminder(args, { admin, push });
    expect(r).toEqual({ sent: false, reason: 'no_line_user' });
    expect(push).not.toHaveBeenCalled();
    expect(updates).toHaveLength(1);
  });

  it('stamps without pushing when the shop has no channel token', async () => {
    const prevEnv = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    delete process.env.LINE_CHANNEL_ACCESS_TOKEN;
    try {
      const { admin, updates } = stubAdmin({ bookings: booking, line_users: { line_user_id: 'Uabc' }, shops: { ...shop, line_channel_access_token: null } });
      const push = vi.fn();
      const r = await safeNotifyBookingReminder(args, { admin, push });
      expect(r).toEqual({ sent: false, reason: 'no_token' });
      expect(push).not.toHaveBeenCalled();
      expect(updates).toHaveLength(1);
    } finally {
      if (prevEnv !== undefined) process.env.LINE_CHANNEL_ACCESS_TOKEN = prevEnv;
    }
  });

  it('leaves the flag unset on a transient push failure so the next tick retries', async () => {
    const { admin, updates } = stubAdmin({ bookings: booking, line_users: { line_user_id: 'Uabc' }, shops: shop });
    const push = vi.fn().mockRejectedValue(new Error('LINE push failed: 429'));
    const r = await safeNotifyBookingReminder(args, { admin, push });
    expect(r.sent).toBe(false);
    expect(r.reason).toBe('push_failed');
    expect(r.error).toContain('429');
    expect(updates).toHaveLength(0);
  });

  it('does nothing when the booking was already reminded', async () => {
    const { admin, updates } = stubAdmin({ bookings: { ...booking, reminder_sent_at: '2026-09-15T02:00:00Z' }, line_users: { line_user_id: 'Uabc' }, shops: shop });
    const push = vi.fn();
    const r = await safeNotifyBookingReminder(args, { admin, push });
    expect(r).toEqual({ sent: false, reason: 'already_sent' });
    expect(push).not.toHaveBeenCalled();
    expect(updates).toHaveLength(0);
  });

  it('reports not_found for a booking from another shop', async () => {
    const { admin, updates } = stubAdmin({ bookings: null, line_users: null, shops: shop });
    const push = vi.fn();
    const r = await safeNotifyBookingReminder(args, { admin, push });
    expect(r).toEqual({ sent: false, reason: 'not_found' });
    expect(push).not.toHaveBeenCalled();
    expect(updates).toHaveLength(0);
  });
});
