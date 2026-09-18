import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { PUBLIC_BOOKING_SELECT, resolveDriverToken } from '@/lib/public/resolve';
import { getSiteSettings } from '@/lib/booking/server';
import { toBangkokStamp } from '@/lib/booking/slot-time';
import { CHECKIN_STATUSES } from '@/lib/booking/status-flow';
import { addFriendUrl, getLineConfig } from '@/lib/line/config';

/** Driver page data: the DO, the dock and the live status. Read-only. */
export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await ctx.params;
    const admin = createAdminClient();
    const resolved = await resolveDriverToken(admin, token);
    if (!resolved.ok) return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    const { booking: ref } = resolved;

    const [{ data: booking }, { data: shop }, settings, line] = await Promise.all([
      admin.from('bookings').select(`${PUBLIC_BOOKING_SELECT},driver_line_user_id,line_users!bookings_driver_line_user_id_fkey(display_name)`).eq('id', ref.id).eq('shop_id', ref.shop_id).maybeSingle(),
      admin.from('shops').select('name,phone,address').eq('id', ref.shop_id).maybeSingle(),
      getSiteSettings(admin, ref.shop_id),
      getLineConfig(admin, ref.shop_id),
    ]);
    if (!booking) return NextResponse.json({ error: 'ไม่พบคิว' }, { status: 404 });

    const { driver_token_version: _v, driver_line_user_id: _d, line_users: driverLine, ...pub } = booking as unknown as Record<string, unknown>;
    void _v; void _d;
    const today = toBangkokStamp(new Date()).date;
    const canSelfCheckIn = settings.driver_self_checkin && ref.booking_date === today && (CHECKIN_STATUSES as readonly string[]).includes(ref.status);

    return NextResponse.json({
      data: {
        site: { name: shop?.name ?? 'Fameline', phone: shop?.phone ?? null, address: shop?.address ?? null },
        booking: pub,
        today,
        can_self_check_in: canSelfCheckIn,
        early_arrival_minutes: settings.early_arrival_minutes,
        grace_minutes: settings.grace_minutes,
        line: { liff_id: line.liff_id, add_friend_url: addFriendUrl(line), linked_name: ((driverLine as { display_name?: string | null } | null)?.display_name) ?? null, enabled: Boolean(line.channel_access_token && line.liff_id && line.login_channel_id) },
      },
    });
  } catch (e) {
    console.error('[public/driver]', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาด กรุณาลองใหม่' }, { status: 500 });
  }
}
