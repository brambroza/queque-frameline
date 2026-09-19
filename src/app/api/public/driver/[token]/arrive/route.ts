import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveDriverToken } from '@/lib/public/resolve';
import { getSiteSettings, logBooking } from '@/lib/booking/server';
import { toBangkokStamp } from '@/lib/booking/slot-time';
import { CHECKIN_STATUSES, transitionStamps } from '@/lib/booking/status-flow';
import { safeCreateNotification } from '@/lib/notifications/createNotification';
import { safeNotifyStaffGroup } from '@/lib/line/notify';
import { effectivePlate } from '@/lib/booking/plate';
import { checkGeofence, geofenceMessage, type BranchGeofence } from '@/lib/booking/geofence';
import { z } from 'zod';

/** Position from the driver's phone. Optional: only required when the branch is fenced. */
const BodySchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  accuracy: z.number().min(0).max(100_000).optional(),
}).partial({ lat: true, lng: true });

/**
 * Driver "มาถึงแล้ว" — only when the site enabled self check-in, only on the
 * appointment day, and (when the branch has coordinates) only from inside the
 * branch's check-in radius.
 */
export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
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

    const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: 'ข้อมูลตำแหน่งไม่ถูกต้อง' }, { status: 400 });
    const position = parsed.data.lat !== undefined && parsed.data.lng !== undefined ? { lat: parsed.data.lat, lng: parsed.data.lng } : null;

    const { data: row } = await admin.from('bookings').select('branch_id').eq('id', booking.id).eq('shop_id', booking.shop_id).maybeSingle();
    const branchId = (row?.branch_id as string | null) ?? null;
    const { data: branch } = branchId
      ? await admin.from('branches').select('latitude,longitude,checkin_radius_m').eq('id', branchId).eq('shop_id', booking.shop_id).maybeSingle()
      : { data: null };
    const fence = checkGeofence(branch as BranchGeofence | null, position, parsed.data.accuracy);
    if (!fence.ok) return NextResponse.json({ error: geofenceMessage(fence), reason: fence.reason, distance_m: fence.distanceM ?? null, radius_m: fence.radiusM }, { status: 403 });

    const stamps = transitionStamps(booking.status, 'checked_in', { now: new Date(), actorId: null, callCount: 0, calledTimeoutMinutes: settings.called_timeout_minutes });
    const { data: updated, error } = await admin
      .from('bookings')
      .update({ status: 'checked_in', ...stamps })
      .eq('id', booking.id)
      .eq('shop_id', booking.shop_id)
      .eq('status', booking.status)
      .select('id,queue_number,branch_id,plate_number,plate_number_actual,resource_name');
    if (error) throw error;
    if (!updated || updated.length === 0) return NextResponse.json({ error: 'สถานะคิวเปลี่ยนไปแล้ว กรุณารีเฟรช' }, { status: 409 });

    const queue = String(updated[0].queue_number ?? '');
    await logBooking(admin, { companyId: booking.company_id, shopId: booking.shop_id, bookingId: booking.id, action: 'status_change', description: `${queue}: คนขับเช็คอินเอง${fence.enforced ? ` (ห่างคลัง ${fence.distanceM} ม.)` : ''}`, from: { status: booking.status }, to: { status: 'checked_in', ...(fence.enforced ? { distance_m: fence.distanceM, radius_m: fence.radiusM } : { geofence: 'not_configured' }) }, actorKind: 'driver' });
    await safeCreateNotification(admin, {
      companyId: booking.company_id, shopId: booking.shop_id, branchId: (updated[0].branch_id as string | null) ?? null,
      type: 'driver_checked_in', category: 'bookings', priority: 'medium', title: `รถมาถึงแล้ว ${queue}`, message: `คนขับคิว ${queue} กดมาถึงแล้วจากลิงก์`,
      relatedType: 'booking', relatedId: booking.id, actionUrl: '/portal/queue-board', icon: 'LocalShipping', color: '#6a1b9a',
    });
    await safeNotifyStaffGroup(admin, { shopId: booking.shop_id, bookingId: booking.id, event: { kind: 'arrived', queueNo: queue, plate: effectivePlate(updated[0]) || '-', dock: (updated[0].resource_name as string | null) ?? null, by: 'driver' } });
    return NextResponse.json({ data: { ok: true } });
  } catch (e) {
    console.error('[public/driver/arrive]', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาด กรุณาลองใหม่' }, { status: 500 });
  }
}
