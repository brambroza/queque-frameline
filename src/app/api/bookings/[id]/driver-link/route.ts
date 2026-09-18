import { NextResponse } from 'next/server';
import { requireAuthContext, getErrorStatus } from '@/lib/auth/context';
import { actorFromRoles, getSiteSettings, logBooking } from '@/lib/booking/server';
import { driverLinkExpiry, ensureDriverLink } from '@/lib/booking/driver-link';
import { getLineConfig, liffUrl } from '@/lib/line/config';
import { deriveLinkToken } from '@/lib/tokens';

/**
 * GET  = current driver link (issued on first use).
 * POST = regenerate: the previous link stops working.
 */
async function handle(ctx: { params: Promise<{ id: string }> }, regenerate: boolean) {
  const { supabase, user, profile, roles } = await requireAuthContext({ roles: ['admin', 'staff'] });
  const { id } = await ctx.params;

  const { data: booking } = await supabase
    .from('bookings')
    .select('id,queue_number,booking_date,driver_token_hash,driver_token_version,driver_token_expires_at')
    .eq('id', id)
    .eq('shop_id', profile.shop_id)
    .eq('is_deleted', false)
    .maybeSingle();
  if (!booking) return NextResponse.json({ error: 'ไม่พบคิว' }, { status: 404 });

  const settings = await getSiteSettings(supabase, profile.shop_id);
  const needsIssue = regenerate || !booking.driver_token_hash;
  const version = Number(booking.driver_token_version ?? 0) + (regenerate && booking.driver_token_hash ? 1 : 0);
  const expiresAt = driverLinkExpiry(String(booking.booking_date), settings.driver_token_ttl_days);
  const url = await ensureDriverLink(supabase, { id, shopId: profile.shop_id, bookingDate: String(booking.booking_date), version }, settings.driver_token_ttl_days);
  if (!url) return NextResponse.json({ error: 'ออกลิงก์คนขับไม่สำเร็จ' }, { status: 500 });
  if (needsIssue) {
    await logBooking(supabase, {
      companyId: profile.company_id,
      shopId: profile.shop_id,
      bookingId: id,
      action: 'driver_link',
      description: `${booking.queue_number ?? id}: ${regenerate ? 'สร้างลิงก์คนขับใหม่' : 'ออกลิงก์คนขับ'}`,
      to: { version, expires_at: expiresAt },
      actorKind: actorFromRoles(roles),
      actorId: user.id,
    });
  }
  const line = await getLineConfig(supabase, profile.shop_id);
  return NextResponse.json({ data: { url, liff_url: liffUrl(line, `/driver/${deriveLinkToken('driver', id, version)}`), expires_at: expiresAt } });
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    return await handle(ctx, false);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    return await handle(ctx, true);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}
