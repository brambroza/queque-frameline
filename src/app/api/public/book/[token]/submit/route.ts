import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveBookingToken } from '@/lib/public/resolve';
import { isoDateSchema, slotTimeSchema, vehicleDetailsSchema } from '@/lib/booking/schemas';
import { PLATE_FORMAT_INFO, matchesPlateFormat, normalizePlate, toPlateFormat } from '@/lib/booking/plate';
import { addDaysIso, normalizeSlotTime, toBangkokStamp } from '@/lib/booking/slot-time';
import { resolveInitialBookingStatus } from '@/lib/booking/status-flow';
import { isPaymentCleared } from '@/lib/booking/payment';
import { dockErrorResponse, getSiteSettings, logBooking, resolveDefaultBranchId } from '@/lib/booking/server';
import { safeCreateNotification } from '@/lib/notifications/createNotification';
import { ensureDriverLink } from '@/lib/booking/driver-link';
import { safeNotifyPartner, safeNotifyStaffGroup } from '@/lib/line/notify';

const submitSchema = vehicleDetailsSchema.extend({
  vehicle_type_id: z.string().uuid(),
  booking_date: isoDateSchema,
  start_time: slotTimeSchema,
  // The customer link asks only for the vehicle and its driver; the driver's phone is the contact at the gate.
  driver_name: z.string().trim().min(1).max(120),
  driver_phone: z.string().trim().min(8).max(20).regex(/^[0-9+\-\s()]+$/),
});

/** Customer / supplier books a slot for their SO / PO. */
export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await ctx.params;
    const admin = createAdminClient();
    const resolved = await resolveBookingToken(admin, token);
    if (!resolved.ok) return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    const { doc } = resolved;
    if (doc.status !== 'open' && doc.status !== 'booked') {
      return NextResponse.json({ error: 'เอกสารนี้ปิดแล้ว ไม่สามารถจองคิวได้', code: 'document_closed' }, { status: 409 });
    }

    const parsed = submitSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      const fields = Array.from(new Set(parsed.error.issues.map((i) => i.path.join('.'))));
      return NextResponse.json({ error: 'กรุณาตรวจสอบข้อมูลที่กรอก', fields }, { status: 400 });
    }
    const p = parsed.data;

    // The plate must follow the layout of the chosen vehicle type (the form masks it; this is the real gate).
    const { data: vehicleType, error: vehicleError } = await admin
      .from('services')
      .select('plate_format')
      .eq('id', p.vehicle_type_id)
      .eq('shop_id', doc.shop_id)
      .eq('active', true)
      .eq('is_deleted', false)
      .maybeSingle();
    if (vehicleError) throw vehicleError;
    if (!vehicleType) return NextResponse.json({ error: 'ไม่พบประเภทรถที่เลือก กรุณาเลือกใหม่', fields: ['vehicle_type_id'] }, { status: 400 });
    const plateFormat = toPlateFormat(vehicleType.plate_format);
    if (!matchesPlateFormat(p.plate_number, plateFormat)) {
      return NextResponse.json({ error: `ทะเบียนรถไม่ตรงรูปแบบของประเภทรถนี้ — ${PLATE_FORMAT_INFO[plateFormat].hint}`, fields: ['plate_number'], code: 'plate_format' }, { status: 400 });
    }

    const now = new Date();
    const settings = await getSiteSettings(admin, doc.shop_id);
    const today = toBangkokStamp(now).date;
    const startMs = new Date(`${p.booking_date}T${normalizeSlotTime(p.start_time)}+07:00`).getTime();
    if (startMs < now.getTime() + settings.booking_lead_min_hours * 3_600_000) {
      return NextResponse.json({ error: 'ช่วงเวลานี้จองไม่ทันแล้ว กรุณาเลือกเวลาใหม่', code: 'slot_past' }, { status: 400 });
    }
    if (p.booking_date > addDaysIso(today, settings.booking_horizon_days)) {
      return NextResponse.json({ error: 'เลือกวันไกลเกินกว่าที่เปิดให้จอง', code: 'beyond_horizon' }, { status: 400 });
    }

    // A document without a partner row (should not happen for imports) gets one now, scoped to this shop.
    let partnerId = doc.partner_id;
    if (!partnerId) {
      const { data: created, error: partnerError } = await admin
        .from('customers')
        .insert({ company_id: doc.company_id, shop_id: doc.shop_id, partner_type: doc.doc_type === 'so' ? 'customer' : 'supplier', full_name: doc.partner_name ?? p.driver_name })
        .select('id')
        .single();
      if (partnerError || !created) throw partnerError ?? new Error('partner create failed');
      partnerId = created.id as string;
      await admin.from('external_documents').update({ partner_id: partnerId }).eq('id', doc.id).eq('shop_id', doc.shop_id);
    }

    // An unpaid SO may be booked, but the queue waits as pending until the warehouse records the payment.
    const paymentCleared = isPaymentCleared(doc.doc_type, doc.payment_status);
    const status = resolveInitialBookingStatus({ source: 'customer_link', requireAdminConfirm: settings.require_admin_confirm, paymentCleared });
    const { data: rows, error } = await admin.rpc('create_dock_booking', {
      p_shop_id: doc.shop_id,
      p_branch_id: (doc.branch_id ?? (await resolveDefaultBranchId(admin, doc.shop_id))),
      p_direction: doc.doc_type === 'so' ? 'outbound' : 'inbound',
      p_service_id: p.vehicle_type_id,
      p_date: p.booking_date,
      p_start: normalizeSlotTime(p.start_time),
      p_customer_id: partnerId,
      p_plate_number: normalizePlate(p.plate_number),
      p_status: status,
      p_source: 'customer_link',
      p_resource_id: null,
      p_document_id: doc.id,
      p_driver_name: p.driver_name,
      p_driver_phone: p.driver_phone,
      p_receiver_name: p.receiver_name ?? null,
      p_receiver_phone: p.receiver_phone ?? null,
      p_note: p.note ?? null,
      p_actor: null,
    });
    if (error) {
      const mapped = dockErrorResponse(error.message);
      if (mapped) return NextResponse.json({ error: mapped.error, code: mapped.code }, { status: mapped.status });
      throw error;
    }
    const created = (rows as Array<{ booking_id: string; queue_number: string; do_number: string | null }> | null)?.[0];
    if (!created) throw new Error('create failed');
    if (status === 'confirmed') {
      await ensureDriverLink(admin, { id: created.booking_id, shopId: doc.shop_id, bookingDate: p.booking_date, version: 0 }, settings.driver_token_ttl_days);
    }

    await logBooking(admin, {
      companyId: doc.company_id,
      shopId: doc.shop_id,
      bookingId: created.booking_id,
      action: 'create',
      description: `${created.queue_number}: จองผ่านลิงก์ ${doc.doc_no}`,
      to: { status, queue_number: created.queue_number, do_number: created.do_number },
      actorKind: 'customer',
    });
    await safeCreateNotification(admin, {
      companyId: doc.company_id,
      shopId: doc.shop_id,
      type: 'booking_submitted',
      category: 'bookings',
      priority: status === 'pending' ? 'high' : 'medium',
      title: !paymentCleared ? `คิวใหม่รอชำระเงิน ${created.queue_number}` : status === 'pending' ? `คิวใหม่รอยืนยัน ${created.queue_number}` : `คิวใหม่ ${created.queue_number}`,
      message: `${doc.partner_name ?? '-'} · ${doc.doc_no} · ${p.booking_date} ${p.start_time.slice(0, 5)} · ${normalizePlate(p.plate_number)}`,
      relatedType: 'booking',
      relatedId: created.booking_id,
      actionUrl: '/portal/bookings',
      icon: 'LocalShipping',
      color: '#ed6c02',
      metadata: { doc_no: doc.doc_no, status, payment_pending: !paymentCleared },
    });

    // LINE (never throws): the person who booked, then the warehouse group.
    const [{ data: vt }] = await Promise.all([admin.from('services').select('service_name').eq('id', p.vehicle_type_id).maybeSingle()]);
    await safeNotifyPartner(admin, { shopId: doc.shop_id, bookingId: created.booking_id, kind: status === 'pending' ? 'submitted' : 'confirmed' });
    await safeNotifyStaffGroup(admin, {
      shopId: doc.shop_id, bookingId: created.booking_id,
      event: { kind: 'submitted', queueNo: created.queue_number, partner: doc.partner_name ?? '-', docNo: doc.doc_no, date: p.booking_date, time: p.start_time, plate: normalizePlate(p.plate_number), vehicle: (vt?.service_name as string | null) ?? null, pending: status === 'pending' },
    });

    return NextResponse.json({ data: { queue_number: created.queue_number, status, do_number: created.do_number, payment_pending: !paymentCleared } });
  } catch (e) {
    console.error('[public/book/submit]', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาด กรุณาลองใหม่' }, { status: 500 });
  }
}
