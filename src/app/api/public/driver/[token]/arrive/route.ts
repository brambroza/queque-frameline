import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveDriverToken } from '@/lib/public/resolve';
import { getSiteSettings, logBooking } from '@/lib/booking/server';
import { toBangkokStamp } from '@/lib/booking/slot-time';
import { CHECKIN_STATUSES, transitionStamps } from '@/lib/booking/status-flow';
import { safeCreateNotification } from '@/lib/notifications/createNotification';

/** Driver "มาถึงแล้ว" — only when the site enabled self check-in, only on the appointment day. */
export async function POST(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await ctx.params;
    const admin = createAdminClient();
    const resolved = await resolveDriverToken(admin, token);
    if (!resolved.ok) return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    const { booking } = resolved;

    const settings = await getSiteSettings(admin, booking.shop_id);
    if (!settings.driver_self_checkin) return NextResponse.json({ error: 'กรุณาแจ้งเจ้าหน้าที่หน้าประตูเพื่อเช็คอิน' }, { status: 403 });
    if (booking.booking_date !== toBangkokStamp(new Date()).date) return NextResponse.json({ error: 'เช็คอินได้เฉพาะวันที่นัดเท่านั้น' }, { status: 409 });
    if (booking.status === 'checked_in') return NextResponse.json({ data: { ok: true, already: true } });
    if (!(CHECKIN_STATUSES as readonly string[]).includes(booking.status)) return NextResponse.json({ error: 'คิวนี้เช็คอินไม่ได้แล้ว' }, { status: 409 });

    const stamps = transitionStamps(booking.status, 'checked_in', { now: new Date(), actorId: null, callCount: 0, calledTimeoutMinutes: settings.called_timeout_minutes });
    const { data: updated, error } = await admin
      .from('bookings')
      .update({ status: 'checked_in', ...stamps })
      .eq('id', booking.id)
      .eq('shop_id', booking.shop_id)
      .eq('status', booking.status)
      .select('id,queue_number,branch_id');
    if (error) throw error;
    if (!updated || updated.length === 0) return NextResponse.json({ error: 'สถานะคิวเปลี่ยนไปแล้ว กรุณารีเฟรช' }, { status: 409 });

    const queue = String(updated[0].queue_number ?? '');
    await logBooking(admin, { companyId: booking.company_id, shopId: booking.shop_id, bookingId: booking.id, action: 'status_change', description: `${queue}: คนขับเช็คอินเอง`, from: { status: booking.status }, to: { status: 'checked_in' }, actorKind: 'driver' });
    await safeCreateNotification(admin, {
      companyId: booking.company_id, shopId: booking.shop_id, branchId: (updated[0].branch_id as string | null) ?? null,
      type: 'driver_checked_in', category: 'bookings', priority: 'medium', title: `รถมาถึงแล้ว ${queue}`, message: `คนขับคิว ${queue} กดมาถึงแล้วจากลิงก์`,
      relatedType: 'booking', relatedId: booking.id, actionUrl: '/portal/queue-board', icon: 'LocalShipping', color: '#6a1b9a',
    });
    return NextResponse.json({ data: { ok: true } });
  } catch (e) {
    console.error('[public/driver/arrive]', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาด กรุณาลองใหม่' }, { status: 500 });
  }
}
