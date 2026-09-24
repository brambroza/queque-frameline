import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveBookingToken } from '@/lib/public/resolve';
import { customerVehicleChangeSchema } from '@/lib/booking/schemas';
import { PLATE_FORMAT_INFO, matchesPlateFormat, toPlateFormat } from '@/lib/booking/plate';
import { canCustomerEditVehicle } from '@/lib/booking/status-flow';
import { describeVehicleChange, diffVehicleChange } from '@/lib/booking/vehicle-change';
import { logBooking } from '@/lib/booking/server';
import { safeCreateNotification } from '@/lib/notifications/createNotification';
import { safeNotifyStaffGroup } from '@/lib/line/notify';

/**
 * Customer changes the vehicle (plate) and / or driver of one of their queues
 * from the booking link. Allowed only before the truck is checked in; the
 * warehouse is told through the notification center and the LINE staff group.
 */
export async function PATCH(req: Request, ctx: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await ctx.params;
    const admin = createAdminClient();
    const resolved = await resolveBookingToken(admin, token);
    if (!resolved.ok) return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    const { doc } = resolved;

    const parsed = customerVehicleChangeSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      const fields = Array.from(new Set(parsed.error.issues.map((i) => i.path.join('.'))));
      return NextResponse.json({ error: 'กรุณาตรวจสอบข้อมูลที่กรอก', fields }, { status: 400 });
    }
    const p = parsed.data;

    // The booking must belong to the document this token opens.
    const { data: booking } = await admin
      .from('bookings')
      .select('id,queue_number,status,branch_id,booking_date,start_time,plate_number,plate_number_actual,driver_name,driver_phone,services(plate_format)')
      .eq('id', p.booking_id)
      .eq('shop_id', doc.shop_id)
      .eq('document_id', doc.id)
      .eq('is_deleted', false)
      .maybeSingle();
    if (!booking) return NextResponse.json({ error: 'ไม่พบคิว' }, { status: 404 });

    const from = String(booking.status);
    if (!canCustomerEditVehicle(from)) {
      return NextResponse.json({ error: 'รถมาถึงคลังแล้ว แก้ข้อมูลรถไม่ได้ กรุณาแจ้งเจ้าหน้าที่หน้าประตู', code: 'not_editable' }, { status: 409 });
    }

    // Same gate as the booking form: the plate must follow the vehicle type's layout.
    const service = (booking as { services?: { plate_format?: string | null } | { plate_format?: string | null }[] | null }).services;
    const plateFormat = toPlateFormat((Array.isArray(service) ? service[0] : service)?.plate_format);
    if (!matchesPlateFormat(p.plate_number, plateFormat)) {
      return NextResponse.json({ error: `ทะเบียนรถไม่ตรงรูปแบบของประเภทรถนี้ — ${PLATE_FORMAT_INFO[plateFormat].hint}`, fields: ['plate_number'], code: 'plate_format' }, { status: 400 });
    }

    const diff = diffVehicleChange(
      {
        plate_number: (booking.plate_number as string | null) ?? null,
        plate_number_actual: (booking.plate_number_actual as string | null) ?? null,
        driver_name: (booking.driver_name as string | null) ?? null,
        driver_phone: (booking.driver_phone as string | null) ?? null,
      },
      { plate_number: p.plate_number, driver_name: p.driver_name ?? null, driver_phone: p.driver_phone ?? null },
    );
    if (!diff.plate && !diff.driver) return NextResponse.json({ data: { ok: true, changed: false } });

    const { data: updated, error } = await admin
      .from('bookings')
      .update({ ...diff.update, ...(diff.plate ? { plate_changed_at: new Date().toISOString(), plate_changed_by: null } : {}) })
      .eq('id', booking.id)
      .eq('shop_id', doc.shop_id)
      // Optimistic: refuse if the gate checked the truck in while the form was open.
      .eq('status', from)
      .select('id');
    if (error) throw error;
    if (!updated || updated.length === 0) return NextResponse.json({ error: 'สถานะคิวเปลี่ยนไปแล้ว กรุณารีเฟรช' }, { status: 409 });

    const queueNo = String(booking.queue_number);
    await logBooking(admin, {
      companyId: doc.company_id,
      shopId: doc.shop_id,
      bookingId: booking.id as string,
      action: 'vehicle_change',
      description: describeVehicleChange(queueNo, diff),
      from: { plate_number: booking.plate_number, driver_name: booking.driver_name, driver_phone: booking.driver_phone },
      to: diff.update,
      actorKind: 'customer',
    });

    const summary = [diff.plate ? `ทะเบียน ${diff.plate.from} → ${diff.plate.to}` : null, diff.driver ? `คนขับ ${diff.driver.from} → ${diff.driver.to}` : null].filter(Boolean).join(' · ');
    await safeCreateNotification(admin, {
      companyId: doc.company_id,
      shopId: doc.shop_id,
      branchId: (booking.branch_id as string | null) ?? null,
      type: 'booking_vehicle_changed',
      category: 'bookings',
      // A confirmed queue already has a DO with the old plate on it — the gate must know.
      priority: from === 'pending' ? 'medium' : 'high',
      title: `ลูกค้าเปลี่ยน${diff.plate && diff.driver ? 'รถและคนขับ' : diff.plate ? 'ทะเบียนรถ' : 'คนขับ'} คิว ${queueNo}`,
      message: `${doc.partner_name ?? '-'} · ${doc.doc_no} · ${String(booking.booking_date)} ${String(booking.start_time).slice(0, 5)} · ${summary}`,
      relatedType: 'booking',
      relatedId: booking.id as string,
      actionUrl: '/portal/bookings',
      icon: 'LocalShipping',
      color: '#0288d1',
      metadata: { doc_no: doc.doc_no, status: from, plate: diff.plate, driver: diff.driver },
    });
    await safeNotifyStaffGroup(admin, {
      shopId: doc.shop_id,
      bookingId: booking.id as string,
      event: { kind: 'vehicle_changed', queueNo, partner: doc.partner_name ?? '-', date: String(booking.booking_date), time: String(booking.start_time), plate: diff.plate, driver: diff.driver },
    });

    return NextResponse.json({ data: { ok: true, changed: true, plate_number: diff.update.plate_number ?? booking.plate_number } });
  } catch (e) {
    console.error('[public/book/vehicle]', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาด กรุณาลองใหม่' }, { status: 500 });
  }
}
