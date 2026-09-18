import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveBookingToken } from '@/lib/public/resolve';
import { canTransition, transitionDenialMessage } from '@/lib/booking/status-flow';
import { logBooking } from '@/lib/booking/server';
import { safeCreateNotification } from '@/lib/notifications/createNotification';
import { safeNotifyPartner, safeNotifyStaffGroup } from '@/lib/line/notify';

const schema = z.object({ booking_id: z.string().uuid(), reason: z.string().trim().max(300).optional() });

/** Customer cancels their own queue — only before the vehicle has arrived. */
export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await ctx.params;
    const admin = createAdminClient();
    const resolved = await resolveBookingToken(admin, token);
    if (!resolved.ok) return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    const { doc } = resolved;
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: 'ข้อมูลไม่ถูกต้อง' }, { status: 400 });

    // The booking must belong to the document this token opens.
    const { data: booking } = await admin
      .from('bookings')
      .select('id,queue_number,status,branch_id,booking_date,start_time')
      .eq('id', parsed.data.booking_id)
      .eq('shop_id', doc.shop_id)
      .eq('document_id', doc.id)
      .eq('is_deleted', false)
      .maybeSingle();
    if (!booking) return NextResponse.json({ error: 'ไม่พบคิว' }, { status: 404 });

    const from = String(booking.status);
    const check = canTransition(from, 'cancelled', 'customer');
    if (!check.ok) return NextResponse.json({ error: transitionDenialMessage(check.reason) }, { status: 409 });

    const { data: updated, error } = await admin
      .from('bookings')
      .update({ status: 'cancelled', cancel_reason: parsed.data.reason ?? 'ลูกค้ายกเลิกผ่านลิงก์' })
      .eq('id', booking.id)
      .eq('shop_id', doc.shop_id)
      .eq('status', from)
      .select('id');
    if (error) throw error;
    if (!updated || updated.length === 0) return NextResponse.json({ error: 'สถานะคิวเปลี่ยนไปแล้ว กรุณารีเฟรช' }, { status: 409 });

    await logBooking(admin, {
      companyId: doc.company_id, shopId: doc.shop_id, bookingId: booking.id as string, action: 'cancel',
      description: `${booking.queue_number}: ลูกค้ายกเลิกผ่านลิงก์`, from: { status: from }, to: { status: 'cancelled', reason: parsed.data.reason ?? null }, actorKind: 'customer',
    });
    await safeCreateNotification(admin, {
      companyId: doc.company_id, shopId: doc.shop_id, branchId: (booking.branch_id as string | null) ?? null,
      type: 'booking_cancelled', category: 'bookings', priority: 'high',
      title: `ลูกค้ายกเลิกคิว ${booking.queue_number}`, message: `${doc.partner_name ?? '-'} · ${doc.doc_no}`,
      relatedType: 'booking', relatedId: booking.id as string, actionUrl: '/portal/bookings', icon: 'Cancel', color: '#c62828',
    });
    await safeNotifyPartner(admin, { shopId: doc.shop_id, bookingId: booking.id as string, kind: 'cancelled', byCustomer: true });
    await safeNotifyStaffGroup(admin, { shopId: doc.shop_id, bookingId: booking.id as string, event: { kind: 'customer_cancelled', queueNo: String(booking.queue_number), partner: doc.partner_name ?? '-', date: String(booking.booking_date), time: String(booking.start_time) } });
    return NextResponse.json({ data: { ok: true } });
  } catch (e) {
    console.error('[public/book/cancel]', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาด กรุณาลองใหม่' }, { status: 500 });
  }
}
