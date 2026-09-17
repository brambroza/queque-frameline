import { NextResponse } from 'next/server';
import { requireAuthContext, getErrorStatus } from '@/lib/auth/context';
import { actorFromRoles, getSiteSettings, logBooking } from '@/lib/booking/server';
import { deriveLinkToken, hashToken } from '@/lib/tokens';
import { driverUrl } from '@/lib/links';

/** Driver link lives until N days after the appointment. */
function driverExpiry(bookingDate: string, ttlDays: number): string {
  return new Date(new Date(`${bookingDate}T23:59:59+07:00`).getTime() + ttlDays * 86_400_000).toISOString();
}

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
  const token = deriveLinkToken('driver', id, version);
  const expiresAt = driverExpiry(String(booking.booking_date), settings.driver_token_ttl_days);

  if (needsIssue || booking.driver_token_expires_at !== expiresAt) {
    const { error } = await supabase
      .from('bookings')
      .update({ driver_token_hash: hashToken(token), driver_token_version: version, driver_token_expires_at: expiresAt, updated_by: user.id })
      .eq('id', id)
      .eq('shop_id', profile.shop_id);
    if (error) throw error;
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
  }
  return NextResponse.json({ data: { url: driverUrl(token), expires_at: expiresAt } });
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
