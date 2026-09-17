import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isCronAuthorized } from '@/lib/cron/auth';
import { computeReminderWindow, isInReminderWindow } from '@/lib/line/booking-reminder';
import { safeNotifyBookingReminder } from '@/lib/line/notify-booking-reminder';

/** Vercel Hobby caps a function at 60 s; the batch cap below keeps well inside it. */
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

/** Bookings handled per tick. Anything left is picked up 5 minutes later. */
const MAX_PER_TICK = 200;

/** Statuses that still expect the customer to show up. */
const REMINDABLE_STATUSES = ['pending', 'confirmed', 'waiting'] as const;

type ShopRow = { id: string; reminder_minutes: number | null };
type BookingRow = { id: string; booking_date: string; start_time: string; created_at: string };

/**
 * Called every 5 minutes by Supabase pg_cron (see migration 202609120005).
 * For each shop with reminders on, pushes one LINE notice to every booking
 * that starts within the shop's lead time and has not been reminded yet.
 *
 * A booking created inside the window (booked 20 min ahead, lead 60 min) is
 * stamped without a push: the customer just received the confirmation Flex.
 */
export async function GET(req: Request) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();
  const now = new Date();

  const { data: shopsRaw, error: shopsError } = await admin
    .from('shops')
    .select('id,reminder_minutes')
    .eq('reminder_enabled', true)
    .eq('is_deleted', false);
  if (shopsError) {
    console.warn('[booking-reminders] shops query failed:', shopsError.message);
    return NextResponse.json({ error: 'Query failed' }, { status: 500 });
  }

  const shops = (shopsRaw ?? []) as ShopRow[];
  let sent = 0;
  let skipped = 0;
  let failed = 0;
  let budget = MAX_PER_TICK;

  for (const shop of shops) {
    if (budget <= 0) break;
    const minutes = Number(shop.reminder_minutes) || 60;
    const window = computeReminderWindow(now, minutes);

    // Two dates at most (window ≤ 7 days is fine: dates between from and to).
    const { data: rowsRaw, error } = await admin
      .from('bookings')
      .select('id,booking_date,start_time,created_at')
      .eq('shop_id', shop.id)
      .eq('is_deleted', false)
      .eq('is_demo', false)
      .is('reminder_sent_at', null)
      .not('line_user_id', 'is', null)
      .in('status', [...REMINDABLE_STATUSES])
      .gte('booking_date', window.from.date)
      .lte('booking_date', window.to.date)
      .order('booking_date', { ascending: true })
      .order('start_time', { ascending: true })
      .limit(budget);
    if (error) {
      console.warn('[booking-reminders] bookings query failed:', shop.id, error.message);
      continue;
    }

    // A booking made less than `lead` ago was created inside its own reminder
    // window; the confirmation Flex it just got already serves as the reminder.
    const bookedInsideWindowAfterMs = now.getTime() - minutes * 60_000;
    for (const row of (rowsRaw ?? []) as BookingRow[]) {
      if (budget <= 0) break;
      if (!isInReminderWindow({ date: row.booking_date, time: row.start_time }, window)) continue;
      budget -= 1;

      const createdMs = new Date(row.created_at).getTime();
      const bookedInsideWindow = Number.isFinite(createdMs) && createdMs >= bookedInsideWindowAfterMs;
      if (bookedInsideWindow) {
        await admin
          .from('bookings')
          .update({ reminder_sent_at: now.toISOString() })
          .eq('id', row.id)
          .eq('shop_id', shop.id);
        skipped += 1;
        continue;
      }

      const r = await safeNotifyBookingReminder({ shopId: shop.id, bookingId: row.id, minutesBefore: minutes }, { admin });
      if (r.sent) sent += 1;
      else if (r.reason === 'push_failed') {
        failed += 1;
        console.warn('[booking-reminders] push failed:', row.id, r.error);
      } else skipped += 1;
    }
  }

  return NextResponse.json({ data: { shops: shops.length, sent, skipped, failed } });
}
