import { NextResponse } from 'next/server';
import { requireAuthContext, getErrorStatus } from '@/lib/auth/context';
import { applyBranchScope, assertBranchAllowed } from '@/lib/auth/branch-scope';
import { bookingSchema } from '@/lib/booking/schemas';
import { safeCreateNotification } from '@/lib/notifications/createNotification';
import { resourceBusyMessage, resourceTypeLabel } from '@/lib/booking/resource-types';
import { resourceServesService, resourceServiceMismatchMessage } from '@/lib/booking/resource-service-link';
import { isApprovalTransition, isCallTransition } from '@/lib/booking/status-flow';

/** Minimal shape needed to call a Postgres function — works for both the session and admin clients. */
type RpcClient = { rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown }> };

function toInt(v: string | null, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

/**
 * True when nothing else holds this resource during the window.
 * `excludeBookingId` lets a booking be rescheduled or reassigned without
 * colliding with its own current row.
 */
async function isResourceFree(
  supabase: RpcClient,
  args: { shopId: string; resourceId: string; startAt: Date; endAt: Date; excludeBookingId?: string }
): Promise<boolean> {
  const { data } = await supabase.rpc('is_resource_available', {
    p_shop_id: args.shopId,
    p_resource_id: args.resourceId,
    p_start: args.startAt.toISOString(),
    p_end: args.endAt.toISOString(),
    p_exclude_booking_id: args.excludeBookingId ?? null,
  });
  return data !== false;
}

export async function GET(req: Request) {
  try {
    const { supabase, profile, branchScope } = await requireAuthContext({ roles: ['admin', 'staff'] });
    const { searchParams } = new URL(req.url);
    const date = searchParams.get('date');
    const status = searchParams.get('status');
    const branchId = searchParams.get('branch_id');
    const serviceId = searchParams.get('service_id');
    const resourceId = searchParams.get('resource_id');
    const q = searchParams.get('q');
    const page = toInt(searchParams.get('page'), 1);
    const pageSize = Math.min(toInt(searchParams.get('page_size'), 20), 100);
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from('bookings')
      .select('*, branches(branch_name), services(service_name), customers(full_name,nickname,phone)', { count: 'exact' })
      .eq('shop_id', profile.shop_id)
      .eq('is_deleted', false)
      .order('booking_date', { ascending: true })
      .order('start_time', { ascending: true });

    if (date) query = query.eq('booking_date', date);
    if (status) query = query.eq('status', status);
    query = applyBranchScope(query, branchScope, branchId);
    if (serviceId) query = query.eq('service_id', serviceId);
    if (resourceId) query = resourceId === 'none' ? query.is('resource_id', null) : query.eq('resource_id', resourceId);
    if (q) query = query.or(`queue_number.ilike.%${q}%,note.ilike.%${q}%`);

    const { data, error, count } = await query.range(from, to);
    if (error) throw error;
    return NextResponse.json({ data, pagination: { page, page_size: pageSize, total: count ?? 0 } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}

export async function POST(req: Request) {
  try {
    const { supabase, user, profile, branchScope } = await requireAuthContext({ roles: ['admin', 'staff'] });
    const parsed = bookingSchema.safeParse(await req.json());
    if (!parsed.success) {
      // Field names only — enough for staff to see which box is wrong, no internal detail leaked.
      const fields = Array.from(new Set(parsed.error.issues.map((i) => i.path.join('.')).filter(Boolean)));
      return NextResponse.json(
        { error: fields.length ? `ข้อมูลไม่ถูกต้อง: ${fields.join(', ')}` : 'ข้อมูลไม่ถูกต้อง' },
        { status: 400 },
      );
    }

    const payload = parsed.data;
    assertBranchAllowed(branchScope, payload.branch_id);
    const { count, error: countError } = await supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('shop_id', profile.shop_id)
      .eq('branch_id', payload.branch_id)
      .eq('booking_date', payload.booking_date);

    if (countError) throw countError;
    const queueNumber = `A${String((count ?? 0) + 1).padStart(3, '0')}`;
    const partySize = payload.party_size ?? null;
    const lineUserPk = payload.line_user_pk ?? null;

    let customerId: string | null = null;
    if (lineUserPk) {
      const { data: existingByLine } = await supabase
        .from('customers')
        .select('id')
        .eq('shop_id', profile.shop_id)
        .eq('line_user_id', lineUserPk)
        .eq('is_deleted', false)
        .order('updated_at', { ascending: false })
        .limit(1);
      customerId = existingByLine?.[0]?.id ?? null;
    }

    // Only a nickname staff actually typed touches the profile; blank keeps the stored one.
    const nicknamePatch = payload.customer_nickname ? { nickname: payload.customer_nickname } : {};

    if (!customerId) {
      const { data: customer, error: customerError } = await supabase
        .from('customers')
        .upsert(
          {
            company_id: profile.company_id,
            shop_id: profile.shop_id,
            line_user_id: lineUserPk,
            full_name: payload.customer_name,
            phone: payload.customer_phone,
            ...nicknamePatch,
            created_by: user.id,
            updated_by: user.id,
          },
          { onConflict: 'shop_id,phone' },
        )
        .select('id')
        .single();
      if (customerError || !customer) throw customerError ?? new Error('Customer upsert failed');
      customerId = customer.id;
    } else {
      await supabase
        .from('customers')
        .update({ full_name: payload.customer_name, phone: payload.customer_phone, ...nicknamePatch, updated_by: user.id })
        .eq('id', customerId)
        .eq('shop_id', profile.shop_id);
    }

    const { data: service } = await supabase
      .from('services')
      .select('duration_minutes,service_name')
      .eq('id', payload.service_id)
      .eq('shop_id', profile.shop_id)
      .maybeSingle();

    const startLabel = payload.start_time.length === 5 ? `${payload.start_time}:00` : payload.start_time;
    const startAt = new Date(`${payload.booking_date}T${startLabel}+07:00`);
    const endAt = new Date(startAt.getTime() + Math.max(service?.duration_minutes ?? 30, 5) * 60000);
    const endTime = `${String(endAt.getHours()).padStart(2, '0')}:${String(endAt.getMinutes()).padStart(2, '0')}:00`;

    let assignedResource: {
      resource_id: string;
      resource_name: string;
      resource_type: string | null;
      capacity: number;
      unit_price: number;
    } | null = null;
    if (payload.resource_id) {
      const { data: selectedResource } = await supabase
        .from('booking_resources')
        .select('id,resource_name,resource_type,capacity,unit_price,service_ids')
        .eq('id', payload.resource_id)
        .eq('shop_id', profile.shop_id)
        .eq('is_deleted', false)
        .eq('active', true)
        .maybeSingle();
      if (selectedResource) {
        // A resource linked to specific services can only be booked for those.
        if (!resourceServesService(selectedResource, payload.service_id)) {
          return NextResponse.json(
            { error: resourceServiceMismatchMessage(resourceTypeLabel(selectedResource.resource_type)) },
            { status: 400 },
          );
        }
        const free = await isResourceFree(supabase, {
          shopId: profile.shop_id,
          resourceId: selectedResource.id as string,
          startAt,
          endAt,
        });
        if (!free) {
          return NextResponse.json({ error: resourceBusyMessage(selectedResource.resource_type) }, { status: 409 });
        }
        assignedResource = {
          resource_id: selectedResource.id as string,
          resource_name: String(selectedResource.resource_name ?? '-'),
          resource_type: (selectedResource.resource_type as string | null) ?? null,
          capacity: Number(selectedResource.capacity ?? 1),
          unit_price: Number(selectedResource.unit_price ?? 0),
        };
      }
    } else if (partySize && partySize > 0) {
      const { data: candidates } = await supabase.rpc('find_available_resources', {
        p_shop_id: profile.shop_id,
        p_branch_id: payload.branch_id,
        p_resource_type: 'table',
        p_party_size: partySize,
        p_start_time: startAt.toISOString(),
        p_end_time: endAt.toISOString(),
      });
      const top = candidates?.[0] as { resource_id?: string; resource_name?: string; capacity?: number } | undefined;
      if (top?.resource_id) {
        const { data: resourcePrice } = await supabase
          .from('booking_resources')
          .select('unit_price')
          .eq('id', top.resource_id)
          .eq('shop_id', profile.shop_id)
          .maybeSingle();
        assignedResource = {
          resource_id: top.resource_id,
          resource_name: top.resource_name ?? '-',
          resource_type: 'table',
          capacity: Number(top.capacity ?? 1),
          unit_price: Number(resourcePrice?.unit_price ?? 0),
        };
      }
    }

    const { data: inserted, error } = await supabase
      .from('bookings')
      .insert({
        company_id: profile.company_id,
        shop_id: profile.shop_id,
        branch_id: payload.branch_id,
        service_id: payload.service_id,
        customer_id: customerId,
        line_user_id: lineUserPk,
        booking_date: payload.booking_date,
        start_time: payload.start_time,
        end_time: endTime,
        queue_number: queueNumber,
        status: payload.status,
        party_size: partySize,
        resource_id: assignedResource?.resource_id ?? null,
        resource_name: assignedResource?.resource_name ?? null,
        resource_capacity: assignedResource?.capacity ?? null,
        note: payload.note,
        created_by: user.id,
        updated_by: user.id,
      })
      .select('id')
      .single();

    if (error || !inserted) throw error ?? new Error('Create booking failed');

    await supabase.from('booking_logs').insert({
      company_id: profile.company_id,
      shop_id: profile.shop_id,
      booking_id: inserted.id,
      action: 'create',
      description: `Created booking ${queueNumber}`,
      created_by: user.id,
      updated_by: user.id,
    });

    if (assignedResource?.resource_id) {
      await supabase.from('booking_resource_assignments').insert({
        company_id: profile.company_id,
        shop_id: profile.shop_id,
        branch_id: payload.branch_id,
        booking_id: inserted.id,
        resource_id: assignedResource.resource_id,
        assigned_by: user.id,
        note: payload.resource_id ? 'manual_assign' : 'auto_assign_by_party_size',
      });
    }

    await safeCreateNotification(supabase, {
      companyId: profile.company_id,
      shopId: profile.shop_id,
      branchId: payload.branch_id,
      userId: user.id,
      type: 'booking_created',
      category: 'bookings',
      priority: 'medium',
      title: `New booking ${queueNumber}`,
      message: `Booking created for ${payload.booking_date} ${payload.start_time.slice(0, 5)}`,
      relatedType: 'booking',
      relatedId: inserted.id,
      actionUrl: '/portal/bookings',
      icon: 'EventAvailable',
      color: '#2e7d32',
      metadata: { queue_number: queueNumber, status: payload.status },
      createdBy: user.id,
    });

    return NextResponse.json({ data: { ok: true, queue_number: queueNumber } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}

export async function PATCH(req: Request) {
  try {
    const { supabase, user, profile, branchScope } = await requireAuthContext({ roles: ['admin', 'staff'] });
    const body = await req.json();
    const id = body.id as string;
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const { data: before } = await supabase
      .from('bookings')
      .select('id,queue_number,status,branch_id,service_id,booking_date,start_time,end_time,resource_id,resource_name,call_count')
      .eq('id', id)
      .eq('shop_id', profile.shop_id)
      .maybeSingle();
    if (!before) return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    assertBranchAllowed(branchScope, before.branch_id);

    // --- Move: date / time and/or resource (trainer, stylist, table) in one step ---
    // One request so a slot + provider change validates once, writes once and
    // pushes the customer a single LINE notice.
    const wantsSlot = body.booking_date !== undefined || body.start_time !== undefined;
    const wantsResource = body.resource_id !== undefined;
    if (wantsSlot || wantsResource) {
      const newDate = (body.booking_date as string | undefined) ?? String(before.booking_date);
      const rawTime = (body.start_time as string | undefined) ?? String(before.start_time);
      const newTime = rawTime.length === 5 ? `${rawTime}:00` : rawTime;
      const prevResourceId = (before.resource_id as string | null) ?? null;
      const nextResourceId = wantsResource ? ((body.resource_id as string | null) || null) : prevResourceId;

      const slotChanged = newDate !== String(before.booking_date) || newTime.slice(0, 5) !== String(before.start_time).slice(0, 5);
      const resourceChanged = nextResourceId !== prevResourceId;
      if (!slotChanged && !resourceChanged) return NextResponse.json({ data: { ok: true } });

      const [{ data: svc }, { data: prevResource }, { data: selected }] = await Promise.all([
        supabase.from('services').select('duration_minutes').eq('id', before.service_id).eq('shop_id', profile.shop_id).maybeSingle(),
        prevResourceId
          ? supabase.from('booking_resources').select('resource_type').eq('id', prevResourceId).eq('shop_id', profile.shop_id).maybeSingle()
          : Promise.resolve({ data: null as { resource_type: string | null } | null }),
        nextResourceId && resourceChanged
          ? supabase.from('booking_resources').select('id,resource_name,resource_type,capacity,service_ids').eq('id', nextResourceId).eq('shop_id', profile.shop_id).eq('is_deleted', false).eq('active', true).maybeSingle()
          : Promise.resolve({ data: null as { id: string; resource_name: string | null; resource_type: string | null; capacity: number | null; service_ids: string[] | null } | null }),
      ]);
      if (nextResourceId && resourceChanged && !selected) {
        return NextResponse.json({ error: 'ไม่พบผู้ให้บริการ/ทรัพยากรที่เลือก' }, { status: 400 });
      }
      if (selected && !resourceServesService(selected, before.service_id as string | null)) {
        return NextResponse.json(
          { error: resourceServiceMismatchMessage(resourceTypeLabel(selected.resource_type)) },
          { status: 400 },
        );
      }

      const startAt = new Date(`${newDate}T${newTime}+07:00`);
      const endAt = new Date(startAt.getTime() + Math.max(Number(svc?.duration_minutes ?? 30), 5) * 60_000);
      const endTime = `${String(endAt.getHours()).padStart(2, '0')}:${String(endAt.getMinutes()).padStart(2, '0')}:00`;

      // Whatever holds the booking after the move must be free in the target
      // window. Exclude this booking so its own old slot never blocks it.
      if (nextResourceId) {
        const free = await isResourceFree(supabase, {
          shopId: profile.shop_id,
          resourceId: nextResourceId,
          startAt,
          endAt,
          excludeBookingId: id,
        });
        if (!free) {
          const busyType = selected?.resource_type ?? prevResource?.resource_type ?? null;
          return NextResponse.json({ error: resourceBusyMessage(busyType) }, { status: 409 });
        }
      }

      const update: Record<string, unknown> = { updated_by: user.id };
      if (slotChanged) {
        update.booking_date = newDate;
        update.start_time = `${newTime.slice(0, 5)}:00`;
        update.end_time = endTime;
      }
      if (resourceChanged) {
        update.resource_id = selected?.id ?? null;
        update.resource_name = selected?.resource_name ?? null;
        update.resource_capacity = selected ? Number(selected.capacity ?? 1) : null;
      }
      const { error } = await supabase.from('bookings').update(update).eq('id', id).eq('shop_id', profile.shop_id);
      if (error) throw error;

      const queueLabel = before.queue_number ?? id;
      const nextResourceType = selected?.resource_type ?? prevResource?.resource_type ?? null;
      const assignedLabel = resourceTypeLabel(nextResourceType);
      const logLines: string[] = [];
      if (slotChanged) logLines.push(`Rescheduled ${queueLabel} to ${newDate} ${newTime.slice(0, 5)}`);
      if (resourceChanged) {
        logLines.push(selected ? `Assigned ${assignedLabel} ${selected.resource_name} to ${queueLabel}` : `Removed assigned resource from ${queueLabel}`);
      }
      await supabase.from('booking_logs').insert({
        company_id: profile.company_id,
        shop_id: profile.shop_id,
        booking_id: id,
        action: 'update',
        description: logLines.join('; '),
        created_by: user.id,
      });

      await safeCreateNotification(supabase, {
        companyId: profile.company_id,
        shopId: profile.shop_id,
        branchId: before.branch_id,
        userId: user.id,
        type: slotChanged ? 'booking_rescheduled' : 'booking_updated',
        category: 'bookings',
        priority: 'medium',
        title: slotChanged
          ? `${queueLabel} rescheduled`
          : `${queueLabel} — ${selected ? `${assignedLabel}: ${selected.resource_name}` : 'ถอดผู้ให้บริการ'}`,
        message: logLines.join('; '),
        relatedType: 'booking',
        relatedId: id,
        actionUrl: '/portal/bookings',
        icon: slotChanged ? 'EventRepeat' : 'AssignmentInd',
        color: '#1565c0',
        metadata: {
          prev_date: before.booking_date,
          prev_time: before.start_time,
          new_date: newDate,
          new_time: newTime.slice(0, 5),
          prev_resource: before.resource_name ?? null,
          next_resource: resourceChanged ? selected?.resource_name ?? null : before.resource_name ?? null,
        },
        createdBy: user.id,
      });
      return NextResponse.json({ data: { ok: true } });
    }

    // --- Status update ---
    const status = body.status as string | undefined;
    if (!status) return NextResponse.json({ error: 'Missing status or date/time for reschedule' }, { status: 400 });

    // "เรียกคิว": stamp who called and how many times, so the signage sorts by
    // called_at and a repeat call can say "ครั้งที่ 2" in the customer's LINE.
    const isCall = isCallTransition(before.status as string, status);
    const callCount = isCall ? Number(before.call_count ?? 0) + 1 : Number(before.call_count ?? 0);
    const update: Record<string, unknown> = { status, updated_by: user.id };
    if (isCall) {
      update.called_at = new Date().toISOString();
      update.called_by = user.id;
      update.call_count = callCount;
    }

    const { error } = await supabase
      .from('bookings')
      .update(update)
      .eq('id', id)
      .eq('shop_id', profile.shop_id);
    if (error) throw error;

    const isCancelled = status === 'cancelled';
    const isApproval = isApprovalTransition(before.status as string, status);
    await safeCreateNotification(supabase, {
      companyId: profile.company_id,
      shopId: profile.shop_id,
      branchId: before.branch_id,
      userId: user.id,
      type: isCancelled ? 'booking_cancelled' : isApproval ? 'booking_confirmed' : status === 'called' ? 'booking_updated' : 'booking_confirmed',
      category: 'bookings',
      priority: isCancelled ? 'high' : 'medium',
      title: `${before.queue_number ?? 'Queue'} → ${status}`,
      message: isCall
        ? `Called ${before.queue_number ?? id} (call #${callCount})`
        : `Status changed from ${before.status} to ${status}`,
      relatedType: 'booking',
      relatedId: id,
      actionUrl: '/portal/bookings',
      icon: isCancelled ? 'Cancel' : isCall ? 'Campaign' : 'EventAvailable',
      color: isCancelled ? '#c62828' : '#1565c0',
      metadata: { prev_status: before.status, next_status: status, call_count: isCall ? callCount : undefined },
      createdBy: user.id,
    });
    return NextResponse.json({ data: { ok: true, call_count: isCall ? callCount : undefined } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}

export async function DELETE(req: Request) {
  try {
    const { supabase, user, profile, branchScope } = await requireAuthContext({ roles: ['admin'] });
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const { data: before } = await supabase
      .from('bookings')
      .select('id,queue_number,status,is_deleted,branch_id,booking_date,start_time')
      .eq('id', id)
      .eq('shop_id', profile.shop_id)
      .maybeSingle();
    if (!before) return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    assertBranchAllowed(branchScope, before.branch_id);

    const { error } = await supabase
      .from('bookings')
      .update({ is_deleted: true, status: 'cancelled', updated_by: user.id })
      .eq('id', id)
      .eq('shop_id', profile.shop_id);

    if (error) throw error;

    if (before) {
      await safeCreateNotification(supabase, {
        companyId: profile.company_id,
        shopId: profile.shop_id,
        branchId: before.branch_id,
        userId: user.id,
        type: 'booking_cancelled',
        category: 'bookings',
        priority: 'high',
        title: `${before.queue_number ?? 'Queue'} cancelled`,
        message: 'Booking was cancelled by staff',
        relatedType: 'booking',
        relatedId: before.id,
        actionUrl: '/portal/bookings',
        icon: 'Cancel',
        color: '#c62828',
        metadata: { deleted: true },
        createdBy: user.id,
      });
    }
    return NextResponse.json({ data: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}
