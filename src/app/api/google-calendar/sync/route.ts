import { NextResponse } from 'next/server';
import { requireAuthContext, getErrorStatus } from '@/lib/auth/context';
import { createAdminClient } from '@/lib/supabase/admin';
import { safeSyncBookingToGoogleCalendar } from '@/lib/google-calendar/sync';

const SYNC_LIMIT = 100;
const CONCURRENCY = 5;

function bangkokToday() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

export async function POST() {
  try {
    const { profile } = await requireAuthContext({
      roles: ['super_admin', 'shop_owner', 'branch_manager'],
    });
    const admin = createAdminClient();
    const { data: connection } = await admin
      .from('google_calendar_connections')
      .select('id')
      .eq('company_id', profile.company_id)
      .eq('shop_id', profile.shop_id)
      .maybeSingle();
    if (!connection) {
      return NextResponse.json({ error: 'Google Calendar is not connected' }, { status: 409 });
    }

    const { data, error } = await admin
      .from('bookings')
      .select('id')
      .eq('company_id', profile.company_id)
      .eq('shop_id', profile.shop_id)
      .eq('is_deleted', false)
      .neq('status', 'cancelled')
      .gte('booking_date', bangkokToday())
      .order('booking_date', { ascending: true })
      .order('start_time', { ascending: true })
      .limit(SYNC_LIMIT);
    if (error) throw error;

    const bookingIds = (data ?? []).map((row) => row.id as string);
    const results = new Array<Awaited<ReturnType<typeof safeSyncBookingToGoogleCalendar>>>(bookingIds.length);
    let cursor = 0;
    async function worker() {
      while (cursor < bookingIds.length) {
        const index = cursor;
        cursor += 1;
        results[index] = await safeSyncBookingToGoogleCalendar(profile.shop_id, bookingIds[index]);
      }
    }
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, bookingIds.length) }, () => worker()));

    return NextResponse.json({
      data: {
        total: bookingIds.length,
        synced: results.filter((result) => result.status === 'synced').length,
        skipped: results.filter((result) => result.status === 'skipped').length,
        failed: results.filter((result) => result.status === 'failed').length,
        limited: bookingIds.length === SYNC_LIMIT,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to sync Google Calendar' },
      { status: getErrorStatus(error) },
    );
  }
}
