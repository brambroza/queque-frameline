import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveShopByKeyOrId } from '@/lib/line/shop-resolver';
import { safeSyncBookingToGoogleCalendar } from '@/lib/google-calendar/sync';
import { CUSTOMER_CANCELLABLE_STATUSES } from '@/lib/booking/status-flow';

const schema = z.object({
  line_user_id: z.string().min(1),
  booking_id: z.string().uuid(),
});

export async function POST(req: Request, { params }: { params: Promise<{ shopKey: string }> }) {
  const { shopKey } = await params;
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  const payload = parsed.data;

  const admin = createAdminClient();
  const shop = await resolveShopByKeyOrId(admin, shopKey);
  if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 });

  const { data: lineUser } = await admin
    .from('line_users')
    .select('id')
    .eq('shop_id', shop.id)
    .eq('line_user_id', payload.line_user_id)
    .eq('is_deleted', false)
    .maybeSingle();
  if (!lineUser) return NextResponse.json({ error: 'Line user not found' }, { status: 404 });

  const { data: booking } = await admin
    .from('bookings')
    .select('id,status,queue_number')
    .eq('id', payload.booking_id)
    .eq('shop_id', shop.id)
    .eq('line_user_id', lineUser.id)
    .eq('is_deleted', false)
    .maybeSingle();
  if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 });

  const cancelable = new Set<string>(CUSTOMER_CANCELLABLE_STATUSES);
  if (!cancelable.has(String(booking.status))) {
    return NextResponse.json({ error: 'This booking cannot be cancelled' }, { status: 400 });
  }

  const { error } = await admin
    .from('bookings')
    .update({
      status: 'cancelled',
      note: 'Cancelled by customer via LIFF',
    })
    .eq('id', booking.id)
    .eq('shop_id', shop.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await admin.from('booking_logs').insert({
    company_id: shop.company_id,
    shop_id: shop.id,
    booking_id: booking.id,
    action: 'cancel_by_customer_liff',
    description: `Customer cancelled booking ${booking.queue_number}`,
  });

  await safeSyncBookingToGoogleCalendar(shop.id, booking.id);

  return NextResponse.json({ data: true });
}
