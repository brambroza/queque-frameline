import { NextResponse } from 'next/server';
import { requireAuthContext, getErrorStatus } from '@/lib/auth/context';
import { createAdminClient } from '@/lib/supabase/admin';
import { rescheduleSchema } from '@/lib/booking/schemas';
import { normalizeSlotTime } from '@/lib/booking/slot-time';
import { actorFromRoles, dockErrorResponse, logBooking } from '@/lib/booking/server';
import { safeNotifyPartner } from '@/lib/line/notify';

/**
 * Move a pending / confirmed / late queue to another date, time or dock, and
 * optionally set its dock time in the same transaction (admin + warehouse staff).
 */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { supabase, user, profile, roles } = await requireAuthContext({ roles: ['admin', 'staff'] });
    const { id } = await ctx.params;
    const parsed = rescheduleSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: 'วันที่หรือเวลาไม่ถูกต้อง' }, { status: 400 });

    const { data: before } = await supabase
      .from('bookings')
      .select('id,queue_number,booking_date,start_time,resource_id,resource_name,service_minutes')
      .eq('id', id)
      .eq('shop_id', profile.shop_id)
      .eq('is_deleted', false)
      .maybeSingle();
    if (!before) return NextResponse.json({ error: 'ไม่พบคิว' }, { status: 404 });

    const { data: rows, error } = await createAdminClient().rpc('move_dock_booking', {
      p_shop_id: profile.shop_id,
      p_booking_id: id,
      p_date: parsed.data.booking_date,
      p_start: normalizeSlotTime(parsed.data.start_time),
      p_resource_id: parsed.data.resource_id ?? null,
      p_actor: user.id,
      p_service_minutes: parsed.data.service_minutes ?? null,
    });
    if (error) {
      const mapped = dockErrorResponse(error.message);
      if (mapped) return NextResponse.json({ error: mapped.error, code: mapped.code }, { status: mapped.status });
      throw error;
    }
    const moved = (rows as Array<{ resource_id: string; end_time: string; queue_number: string }> | null)?.[0];

    await logBooking(supabase, {
      companyId: profile.company_id,
      shopId: profile.shop_id,
      bookingId: id,
      action: 'reschedule',
      description: `${before.queue_number ?? id}: ${before.booking_date} ${String(before.start_time).slice(0, 5)} → ${parsed.data.booking_date} ${parsed.data.start_time.slice(0, 5)}${
        parsed.data.service_minutes !== undefined && parsed.data.service_minutes !== before.service_minutes ? ` · เวลาที่ท่า ${before.service_minutes ?? '-'} → ${parsed.data.service_minutes} นาที` : ''
      }`,
      from: { booking_date: before.booking_date, start_time: before.start_time, dock_id: before.resource_id, queue_number: before.queue_number, service_minutes: before.service_minutes },
      to: { booking_date: parsed.data.booking_date, start_time: parsed.data.start_time, dock_id: moved?.resource_id, queue_number: moved?.queue_number, service_minutes: parsed.data.service_minutes ?? before.service_minutes },
      actorKind: actorFromRoles(roles),
      actorId: user.id,
    });

    await safeNotifyPartner(createAdminClient(), { shopId: profile.shop_id, bookingId: id, kind: 'rescheduled', prev: { date: String(before.booking_date), time: String(before.start_time) } });
    return NextResponse.json({ data: { ok: true, queue_number: moved?.queue_number ?? before.queue_number } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}
