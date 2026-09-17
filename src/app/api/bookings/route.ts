import { NextResponse } from 'next/server';
import { requireAuthContext, getErrorStatus } from '@/lib/auth/context';
import { createAdminClient } from '@/lib/supabase/admin';
import { bookingStatusPatchSchema, dockBookingSchema } from '@/lib/booking/schemas';
import { normalizePlate } from '@/lib/booking/plate';
import { normalizeSlotTime } from '@/lib/booking/slot-time';
import { canTransition, freesDock, isConfirmTransition, transitionDenialMessage, transitionStamps } from '@/lib/booking/status-flow';
import { actorFromRoles, dockErrorResponse, getSiteSettings, logBooking, resolveDefaultBranchId } from '@/lib/booking/server';
import { runAutoCall } from '@/lib/booking/auto-call-runner';
import { ensureDriverLink } from '@/lib/booking/driver-link';
import { safeCreateNotification } from '@/lib/notifications/createNotification';

/** Columns + joins the portal list, board and drawers render. */
const BOOKING_SELECT =
  '*, services(service_name,duration_minutes), customers(full_name,phone,partner_type,code), branches(branch_name), external_documents(doc_no,doc_type)';

function toInt(v: string | null, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

/** Field names only — enough for staff to see which box is wrong, no internal detail leaked. */
function invalidPayload(issues: Array<{ path: Array<string | number> }>) {
  const fields = Array.from(new Set(issues.map((i) => i.path.join('.')).filter(Boolean)));
  return NextResponse.json({ error: fields.length ? `ข้อมูลไม่ถูกต้อง: ${fields.join(', ')}` : 'ข้อมูลไม่ถูกต้อง' }, { status: 400 });
}

/** PostgREST `or()` breaks on these; search terms are short codes / plates so dropping them is safe. */
function sanitizeSearch(q: string) {
  return q.replace(/[,()%*\\]/g, ' ').trim().slice(0, 40);
}

export async function GET(req: Request) {
  try {
    const { supabase, profile } = await requireAuthContext({ roles: ['admin', 'staff'] });
    const { searchParams } = new URL(req.url);
    const page = toInt(searchParams.get('page'), 1);
    const pageSize = Math.min(toInt(searchParams.get('page_size'), 20), 200);
    const from = (page - 1) * pageSize;

    let query = supabase
      .from('bookings')
      .select(BOOKING_SELECT, { count: 'exact' })
      .eq('shop_id', profile.shop_id)
      .eq('is_deleted', false)
      .order('booking_date', { ascending: true })
      .order('start_time', { ascending: true });

    const id = searchParams.get('id');
    const date = searchParams.get('date');
    const dateFrom = searchParams.get('date_from');
    const dateTo = searchParams.get('date_to');
    const status = searchParams.get('status');
    const direction = searchParams.get('direction');
    const serviceId = searchParams.get('service_id');
    const resourceId = searchParams.get('resource_id');
    const documentId = searchParams.get('document_id');
    const q = sanitizeSearch(searchParams.get('q') ?? '');

    if (id) query = query.eq('id', id);
    if (date) query = query.eq('booking_date', date);
    if (dateFrom) query = query.gte('booking_date', dateFrom);
    if (dateTo) query = query.lte('booking_date', dateTo);
    if (status) query = status.includes(',') ? query.in('status', status.split(',')) : query.eq('status', status);
    if (direction === 'inbound' || direction === 'outbound') query = query.eq('direction', direction);
    if (serviceId) query = query.eq('service_id', serviceId);
    if (resourceId) query = resourceId === 'none' ? query.is('resource_id', null) : query.eq('resource_id', resourceId);
    if (documentId) query = query.eq('document_id', documentId);
    if (q) {
      const plate = normalizePlate(q);
      const parts = [`queue_number.ilike.%${q}%`, `do_number.ilike.%${q}%`, `driver_name.ilike.%${q}%`];
      if (plate) parts.push(`plate_number.ilike.%${plate}%`, `plate_number_actual.ilike.%${plate}%`);
      query = query.or(parts.join(','));
    }

    const { data, error, count } = await query.range(from, from + pageSize - 1);
    if (error) throw error;
    return NextResponse.json({ data, pagination: { page, page_size: pageSize, total: count ?? 0 } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}

/** Create a queue from the portal. Admin/staff-created queues are confirmed at once and get their DO. */
export async function POST(req: Request) {
  try {
    const { supabase, user, profile } = await requireAuthContext({ roles: ['admin', 'staff'] });
    const parsed = dockBookingSchema.safeParse(await req.json());
    if (!parsed.success) return invalidPayload(parsed.error.issues);
    const payload = parsed.data;

    const branchId = payload.branch_id ?? (await resolveDefaultBranchId(supabase, profile.shop_id));
    if (!branchId) return NextResponse.json({ error: 'ยังไม่ได้ตั้งค่าสาขา/คลัง' }, { status: 400 });

    // Linked SO/PO must belong to this site and match the direction (SO = outbound, PO = inbound).
    let partnerId = payload.partner_id ?? null;
    if (payload.document_id) {
      const { data: doc } = await supabase
        .from('external_documents')
        .select('id,doc_type,status,partner_id')
        .eq('id', payload.document_id)
        .eq('shop_id', profile.shop_id)
        .eq('is_deleted', false)
        .maybeSingle();
      if (!doc) return NextResponse.json({ error: 'ไม่พบเอกสารที่เลือก' }, { status: 400 });
      if (doc.status === 'cancelled' || doc.status === 'completed') {
        return NextResponse.json({ error: 'เอกสารนี้ปิดแล้ว ไม่สามารถสร้างคิวได้' }, { status: 409 });
      }
      const expected = doc.doc_type === 'so' ? 'outbound' : 'inbound';
      if (expected !== payload.direction) {
        return NextResponse.json({ error: 'ประเภทคิวไม่ตรงกับเอกสาร (SO = รับสินค้า, PO = ส่งสินค้า)' }, { status: 400 });
      }
      partnerId = partnerId ?? (doc.partner_id as string | null);
    }

    if (partnerId) {
      const { data: partner } = await supabase.from('customers').select('id').eq('id', partnerId).eq('shop_id', profile.shop_id).eq('is_deleted', false).maybeSingle();
      if (!partner) return NextResponse.json({ error: 'ไม่พบคู่ค้าที่เลือก' }, { status: 400 });
    } else {
      const partnerType = payload.direction === 'outbound' ? 'customer' : 'supplier';
      const phone = payload.partner_phone ?? null;
      let existingId: string | null = null;
      if (phone) {
        const { data: existing } = await supabase
          .from('customers')
          .select('id')
          .eq('shop_id', profile.shop_id)
          .eq('partner_type', partnerType)
          .eq('phone', phone)
          .eq('is_deleted', false)
          .maybeSingle();
        existingId = (existing?.id as string | undefined) ?? null;
      }
      if (existingId) {
        partnerId = existingId;
      } else {
        const { data: created, error: partnerError } = await supabase
          .from('customers')
          .insert({
            company_id: profile.company_id,
            shop_id: profile.shop_id,
            partner_type: partnerType,
            full_name: payload.partner_name,
            phone,
            created_by: user.id,
            updated_by: user.id,
          })
          .select('id')
          .single();
        if (partnerError || !created) throw partnerError ?? new Error('Partner create failed');
        partnerId = created.id as string;
      }
    }

    // create_dock_booking is service-role only: it locks the day, picks the dock, numbers the queue and issues the DO.
    const admin = createAdminClient();
    const { data: rows, error } = await admin.rpc('create_dock_booking', {
      p_shop_id: profile.shop_id,
      p_branch_id: branchId,
      p_direction: payload.direction,
      p_service_id: payload.service_id,
      p_date: payload.booking_date,
      p_start: normalizeSlotTime(payload.start_time),
      p_customer_id: partnerId,
      p_plate_number: normalizePlate(payload.plate_number),
      p_status: 'confirmed',
      p_source: 'admin',
      p_resource_id: payload.resource_id ?? null,
      p_document_id: payload.document_id ?? null,
      p_driver_name: payload.driver_name ?? null,
      p_driver_phone: payload.driver_phone ?? null,
      p_receiver_name: payload.receiver_name ?? null,
      p_receiver_phone: payload.receiver_phone ?? null,
      p_note: payload.note ?? null,
      p_actor: user.id,
    });
    if (error) {
      const mapped = dockErrorResponse(error.message);
      if (mapped) return NextResponse.json({ error: mapped.error, code: mapped.code }, { status: mapped.status });
      throw error;
    }
    const created = (rows as Array<{ booking_id: string; queue_number: string; resource_id: string; do_number: string | null }> | null)?.[0];
    if (!created) throw new Error('Create booking failed');

    const createSettings = await getSiteSettings(supabase, profile.shop_id);
    await ensureDriverLink(admin, { id: created.booking_id, shopId: profile.shop_id, bookingDate: payload.booking_date, version: 0 }, createSettings.driver_token_ttl_days);

    await logBooking(supabase, {
      companyId: profile.company_id,
      shopId: profile.shop_id,
      bookingId: created.booking_id,
      action: 'create',
      description: `Created ${created.queue_number}${created.do_number ? ` · ${created.do_number}` : ''}`,
      to: { status: 'confirmed', queue_number: created.queue_number, do_number: created.do_number, dock_id: created.resource_id },
      actorKind: 'admin',
      actorId: user.id,
    });

    return NextResponse.json({ data: { ok: true, id: created.booking_id, queue_number: created.queue_number, do_number: created.do_number } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}

/** Status transition. Plate edits and reschedules have their own routes under /api/bookings/[id]. */
export async function PATCH(req: Request) {
  try {
    const { supabase, user, profile, roles } = await requireAuthContext({ roles: ['admin', 'staff'] });
    const parsed = bookingStatusPatchSchema.safeParse(await req.json());
    if (!parsed.success) return invalidPayload(parsed.error.issues);
    const { id, status, cancel_reason: cancelReason } = parsed.data;
    const actor = actorFromRoles(roles);

    const { data: before } = await supabase
      .from('bookings')
      .select('id,queue_number,status,branch_id,resource_id,call_count,do_number,booking_date,driver_token_version')
      .eq('id', id)
      .eq('shop_id', profile.shop_id)
      .eq('is_deleted', false)
      .maybeSingle();
    if (!before) return NextResponse.json({ error: 'ไม่พบคิว' }, { status: 404 });

    const from = String(before.status);
    const check = canTransition(from, status, actor);
    if (!check.ok) return NextResponse.json({ error: transitionDenialMessage(check.reason), code: check.reason }, { status: check.reason === 'admin_only' ? 403 : 409 });

    const admin = createAdminClient();
    const settings = await getSiteSettings(supabase, profile.shop_id);
    let doNumber = (before.do_number as string | null) ?? null;

    if (isConfirmTransition(from, status)) {
      // Atomic in SQL: status + DO number in one statement, so a lost race never burns a number.
      const { data: confirmed, error } = await admin.rpc('confirm_dock_booking', { p_shop_id: profile.shop_id, p_booking_id: id, p_actor: user.id });
      if (error) throw error;
      const row = (confirmed as Array<{ do_number: string | null }> | null)?.[0];
      if (!row) return NextResponse.json({ error: 'คิวนี้ถูกเปลี่ยนสถานะไปแล้ว กรุณารีเฟรช', code: 'stale' }, { status: 409 });
      doNumber = row.do_number;
      await ensureDriverLink(admin, { id, shopId: profile.shop_id, bookingDate: String(before.booking_date), version: Number(before.driver_token_version ?? 0) }, settings.driver_token_ttl_days);
    } else {
      const stamps = transitionStamps(from, status, {
        now: new Date(),
        actorId: user.id,
        callCount: Number(before.call_count ?? 0),
        calledTimeoutMinutes: settings.called_timeout_minutes,
      });
      const update: Record<string, unknown> = { status, updated_by: user.id, ...stamps };
      if (status === 'cancelled') update.cancel_reason = cancelReason ?? null;
      // Conditional on the status we read: two tablets pressing at once cannot both win.
      const { data: updated, error } = await supabase
        .from('bookings')
        .update(update)
        .eq('id', id)
        .eq('shop_id', profile.shop_id)
        .eq('status', from)
        .select('id');
      if (error) throw error;
      if (!updated || updated.length === 0) {
        return NextResponse.json({ error: 'คิวนี้ถูกเปลี่ยนสถานะไปแล้ว กรุณารีเฟรช', code: 'stale' }, { status: 409 });
      }
    }

    const queueLabel = String(before.queue_number ?? id);
    await logBooking(supabase, {
      companyId: profile.company_id,
      shopId: profile.shop_id,
      bookingId: id,
      action: status === 'cancelled' ? 'cancel' : 'status_change',
      description: `${queueLabel}: ${from} → ${status}${isConfirmTransition(from, status) && doNumber ? ` · ${doNumber}` : ''}`,
      from: { status: from },
      to: { status, do_number: isConfirmTransition(from, status) ? doNumber : undefined, cancel_reason: cancelReason },
      actorKind: actor,
      actorId: user.id,
    });

    if (status === 'cancelled' || status === 'no_show' || isConfirmTransition(from, status)) {
      await safeCreateNotification(supabase, {
        companyId: profile.company_id,
        shopId: profile.shop_id,
        branchId: (before.branch_id as string | null) ?? null,
        userId: user.id,
        type: status === 'cancelled' ? 'booking_cancelled' : status === 'no_show' ? 'booking_no_show' : 'booking_confirmed',
        category: 'bookings',
        priority: status === 'confirmed' ? 'medium' : 'high',
        title: `${queueLabel} → ${status}`,
        message: status === 'confirmed' ? `ยืนยันคิว ${queueLabel} · ${doNumber ?? ''}` : `คิว ${queueLabel} เปลี่ยนจาก ${from} เป็น ${status}`,
        relatedType: 'booking',
        relatedId: id,
        actionUrl: '/portal/bookings',
        icon: status === 'confirmed' ? 'EventAvailable' : 'Cancel',
        color: status === 'confirmed' ? '#2e7d32' : '#c62828',
        metadata: { prev_status: from, next_status: status },
        createdBy: user.id,
      });
    }

    // A dock was released: let the next waiting vehicle in.
    let autoCalled: string[] = [];
    if (freesDock(from, status) && before.resource_id) {
      const result = await runAutoCall(admin, { shopId: profile.shop_id, companyId: profile.company_id }, { dockId: before.resource_id as string, settings });
      autoCalled = result.called.map((c) => c.queueNumber);
    }

    return NextResponse.json({ data: { ok: true, status, do_number: doNumber, auto_called: autoCalled } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}

/** Soft delete (admin). A live booking is cancelled first so its slot is released. */
export async function DELETE(req: Request) {
  try {
    const { supabase, user, profile } = await requireAuthContext({ roles: ['admin'] });
    const id = new URL(req.url).searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const { data: before } = await supabase
      .from('bookings')
      .select('id,queue_number,status,resource_id')
      .eq('id', id)
      .eq('shop_id', profile.shop_id)
      .eq('is_deleted', false)
      .maybeSingle();
    if (!before) return NextResponse.json({ error: 'ไม่พบคิว' }, { status: 404 });
    if (before.status === 'called' || before.status === 'serving') {
      return NextResponse.json({ error: 'คิวนี้กำลังอยู่ที่ท่า ปิดงานหรือยกเลิกการเรียกก่อนลบ' }, { status: 409 });
    }

    const from = String(before.status);
    const nextStatus = from === 'completed' || from === 'no_show' ? from : 'cancelled';
    const { error } = await supabase
      .from('bookings')
      .update({ is_deleted: true, status: nextStatus, cancelled_by: nextStatus === 'cancelled' ? user.id : null, updated_by: user.id })
      .eq('id', id)
      .eq('shop_id', profile.shop_id);
    if (error) throw error;

    await logBooking(supabase, {
      companyId: profile.company_id,
      shopId: profile.shop_id,
      bookingId: id,
      action: 'delete',
      description: `Deleted ${before.queue_number ?? id}`,
      from: { status: from },
      to: { status: nextStatus, is_deleted: true },
      actorKind: 'admin',
      actorId: user.id,
    });
    return NextResponse.json({ data: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}
