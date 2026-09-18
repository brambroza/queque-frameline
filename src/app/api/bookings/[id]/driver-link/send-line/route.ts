import { NextResponse } from 'next/server';
import { requireAuthContext, getErrorStatus } from '@/lib/auth/context';
import { createAdminClient } from '@/lib/supabase/admin';
import { getSiteSettings } from '@/lib/booking/server';
import { ensureDriverLink } from '@/lib/booking/driver-link';
import { safeNotifyDriver, safeNotifyPartner } from '@/lib/line/notify';

/**
 * Push the driver's job card. To the driver when one is bound; otherwise to
 * the customer (as the confirmed card, which carries the driver link) so they
 * can forward it.
 */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { supabase, profile } = await requireAuthContext({ roles: ['admin', 'staff'] });
    const { id } = await ctx.params;
    const { data: b } = await supabase.from('bookings').select('id,booking_date,driver_token_version,driver_line_user_id,do_number').eq('id', id).eq('shop_id', profile.shop_id).eq('is_deleted', false).maybeSingle();
    if (!b) return NextResponse.json({ error: 'ไม่พบคิว' }, { status: 404 });
    if (!b.do_number) return NextResponse.json({ error: 'ยืนยันคิวก่อนจึงส่งให้คนขับได้' }, { status: 409 });

    const settings = await getSiteSettings(supabase, profile.shop_id);
    await ensureDriverLink(supabase, { id, shopId: profile.shop_id, bookingDate: String(b.booking_date), version: Number(b.driver_token_version ?? 0) }, settings.driver_token_ttl_days);

    const admin = createAdminClient();
    const target = b.driver_line_user_id ? 'driver' : 'partner';
    const r = target === 'driver'
      ? await safeNotifyDriver(admin, { shopId: profile.shop_id, bookingId: id, kind: 'job' })
      : await safeNotifyPartner(admin, { shopId: profile.shop_id, bookingId: id, kind: 'confirmed' });
    if (!r.sent) {
      const msg = r.reason === 'not_configured' ? 'ยังไม่ได้ตั้งค่า LINE' : r.reason === 'not_linked' ? 'ยังไม่มีใครผูก LINE กับคิวนี้ — ส่งลิงก์คนขับด้วยวิธีอื่น หรือให้ลูกค้าส่งต่อ' : r.reason === 'disabled' ? 'ปิดการแจ้งเตือนทาง LINE อยู่' : 'ส่ง LINE ไม่สำเร็จ';
      return NextResponse.json({ error: msg, code: r.reason }, { status: r.reason === 'push_failed' ? 502 : 409 });
    }
    return NextResponse.json({ data: { ok: true, target } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}
