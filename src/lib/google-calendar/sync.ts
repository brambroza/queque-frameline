import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { customerLabel, customerNickname } from '@/lib/booking/customer-label';
import {
  googleCalendarRequest,
  type GoogleCalendarConnection,
} from '@/lib/google-calendar/oauth';

type SyncResult = { status: 'synced' | 'skipped' | 'failed'; error?: string };

type BookingForCalendar = {
  id: string;
  company_id: string;
  shop_id: string;
  booking_date: string;
  start_time: string;
  queue_number: string;
  status: string;
  note: string | null;
  party_size: number | null;
  resource_name: string | null;
  is_deleted: boolean;
  is_demo: boolean | null;
  branches: { branch_name?: string | null; address?: string | null } | Array<{ branch_name?: string | null; address?: string | null }> | null;
  services: { service_name?: string | null; duration_minutes?: number | null } | Array<{ service_name?: string | null; duration_minutes?: number | null }> | null;
  customers: { full_name?: string | null; phone?: string | null } | Array<{ full_name?: string | null; phone?: string | null }> | null;
};

type EventMapping = {
  id: string;
  calendar_id: string;
  google_event_id: string;
};

function one<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function cleanError(error: unknown) {
  const message = error instanceof Error ? error.message : 'Google Calendar sync failed';
  return message.slice(0, 500);
}

async function googleError(response: Response) {
  const payload = await response.json().catch(() => null) as { error?: { message?: string } } | null;
  return payload?.error?.message?.slice(0, 300) || `Google Calendar API returned ${response.status}`;
}

function bookingEvent(booking: BookingForCalendar) {
  const branch = one(booking.branches);
  const service = one(booking.services);
  const customer = one(booking.customers);
  const startTime = booking.start_time.length === 5 ? `${booking.start_time}:00` : booking.start_time;
  const start = new Date(`${booking.booking_date}T${startTime}+07:00`);
  if (Number.isNaN(start.getTime())) throw new Error('Booking date or time is invalid');
  const durationMinutes = Math.max(Number(service?.duration_minutes ?? 30), 5);
  const end = new Date(start.getTime() + durationMinutes * 60_000);

  const details = [
    `หมายเลขคิว: ${booking.queue_number}`,
    `สถานะ: ${booking.status}`,
    `ลูกค้า: ${customerLabel(customer)}`,
    `โทร: ${customer?.phone || '-'}`,
    booking.party_size ? `จำนวน: ${booking.party_size}` : null,
    booking.resource_name ? `ทรัพยากร: ${booking.resource_name}` : null,
    booking.note ? `หมายเหตุ: ${booking.note}` : null,
    `Booking ID: ${booking.id}`,
  ].filter(Boolean);

  return {
    summary: `คิว ${booking.queue_number} • ${service?.service_name || 'บริการ'} • ${customerNickname(customer) || customer?.full_name || 'ลูกค้า'}`,
    description: details.join('\n'),
    location: [branch?.branch_name, branch?.address].filter(Boolean).join(' • ') || undefined,
    start: { dateTime: start.toISOString(), timeZone: 'Asia/Bangkok' },
    end: { dateTime: end.toISOString(), timeZone: 'Asia/Bangkok' },
    extendedProperties: {
      private: {
        queueBookingId: booking.id,
        queueShopId: booking.shop_id,
      },
    },
  };
}

async function markConnectionError(connection: GoogleCalendarConnection, error: string | null) {
  const admin = createAdminClient();
  await admin
    .from('google_calendar_connections')
    .update({ last_error: error })
    .eq('id', connection.id)
    .eq('company_id', connection.company_id)
    .eq('shop_id', connection.shop_id);
}

export async function syncBookingToGoogleCalendar(shopId: string, bookingId: string): Promise<SyncResult> {
  const admin = createAdminClient();
  const [{ data: connectionData }, { data: bookingData }] = await Promise.all([
    admin
      .from('google_calendar_connections')
      .select('id,company_id,shop_id,calendar_id,access_token_encrypted,refresh_token_encrypted,token_expires_at')
      .eq('shop_id', shopId)
      .maybeSingle(),
    admin
      .from('bookings')
      .select('id,company_id,shop_id,booking_date,start_time,queue_number,status,note,party_size,resource_name,is_deleted,is_demo,branches(branch_name,address),services(service_name,duration_minutes),customers(full_name,nickname,phone)')
      .eq('id', bookingId)
      .eq('shop_id', shopId)
      .maybeSingle(),
  ]);

  const connection = connectionData as GoogleCalendarConnection | null;
  const booking = bookingData as unknown as BookingForCalendar | null;
  if (!connection || !booking || booking.is_demo) return { status: 'skipped' };
  if (connection.company_id !== booking.company_id) throw new Error('Google Calendar tenant mismatch');

  const { data: mappingData } = await admin
    .from('booking_calendar_events')
    .select('id,calendar_id,google_event_id')
    .eq('company_id', booking.company_id)
    .eq('shop_id', shopId)
    .eq('booking_id', booking.id)
    .maybeSingle();
  const mapping = mappingData as EventMapping | null;
  const cancelled = booking.is_deleted || booking.status === 'cancelled';

  if (cancelled) {
    if (!mapping) return { status: 'skipped' };
    const response = await googleCalendarRequest(
      connection,
      `/calendars/${encodeURIComponent(mapping.calendar_id)}/events/${encodeURIComponent(mapping.google_event_id)}?sendUpdates=none`,
      { method: 'DELETE' },
    );
    if (!response.ok && response.status !== 404 && response.status !== 410) {
      throw new Error(await googleError(response));
    }
    await admin
      .from('booking_calendar_events')
      .delete()
      .eq('id', mapping.id)
      .eq('company_id', booking.company_id)
      .eq('shop_id', shopId);
    await markConnectionError(connection, null);
    return { status: 'synced' };
  }

  const event = bookingEvent(booking);
  let response: Response;
  if (mapping) {
    response = await googleCalendarRequest(
      connection,
      `/calendars/${encodeURIComponent(mapping.calendar_id)}/events/${encodeURIComponent(mapping.google_event_id)}?sendUpdates=none`,
      { method: 'PATCH', body: JSON.stringify(event) },
    );
  } else {
    response = new Response(null, { status: 404 });
  }

  if (!mapping || response.status === 404 || response.status === 410) {
    response = await googleCalendarRequest(
      connection,
      `/calendars/${encodeURIComponent(connection.calendar_id)}/events?sendUpdates=none`,
      { method: 'POST', body: JSON.stringify(event) },
    );
  }

  if (!response.ok) throw new Error(await googleError(response));
  const savedEvent = await response.json() as { id?: string; htmlLink?: string };
  if (!savedEvent.id) throw new Error('Google Calendar did not return an event ID');
  const syncedAt = new Date().toISOString();

  const { error: mappingError } = await admin
    .from('booking_calendar_events')
    .upsert({
      company_id: booking.company_id,
      shop_id: shopId,
      booking_id: booking.id,
      calendar_id: connection.calendar_id,
      google_event_id: savedEvent.id,
      google_event_url: savedEvent.htmlLink ?? null,
      last_synced_at: syncedAt,
      last_error: null,
    }, { onConflict: 'shop_id,booking_id' });
  if (mappingError) throw new Error('Unable to save Google Calendar event mapping');

  await admin
    .from('google_calendar_connections')
    .update({ last_synced_at: syncedAt, last_error: null })
    .eq('id', connection.id)
    .eq('company_id', connection.company_id)
    .eq('shop_id', connection.shop_id);
  return { status: 'synced' };
}

export async function safeSyncBookingToGoogleCalendar(shopId: string, bookingId: string): Promise<SyncResult> {
  try {
    return await syncBookingToGoogleCalendar(shopId, bookingId);
  } catch (error) {
    const message = cleanError(error);
    console.error('[Google Calendar] booking sync failed:', { shopId, bookingId, message });
    const admin = createAdminClient();
    await Promise.all([
      admin
        .from('google_calendar_connections')
        .update({ last_error: message })
        .eq('shop_id', shopId),
      admin
        .from('booking_calendar_events')
        .update({ last_error: message })
        .eq('shop_id', shopId)
        .eq('booking_id', bookingId),
    ]).catch(() => undefined);
    return { status: 'failed', error: message };
  }
}
