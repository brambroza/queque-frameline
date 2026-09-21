import { NextResponse } from 'next/server';
import { requireAuthContext, getErrorStatus } from '@/lib/auth/context';
import { bookingDurationSchema } from '@/lib/booking/schemas';
import { actorFromRoles, dockErrorResponse, logBooking } from '@/lib/booking/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Change how long a queue holds its dock. The vehicle type only gives the
 * default; real picking time differs, so the warehouse may stretch or shrink
 * it. Refused when the longer stay would overlap the next queue on that dock.
 */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { supabase, user, profile, roles } = await requireAuthContext({ roles: ['admin', 'staff'] });
    const { id } = await ctx.params;
    const parsed = bookingDurationSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: 'เวลาที่ท่าต้องอยู่ระหว่าง 5–1440 นาที' }, { status: 400 });

    const { data: before } = await supabase
      .from('bookings')
      .select('id,queue_number,service_minutes,end_time')
      .eq('id', id)
      .eq('shop_id', profile.shop_id)
      .eq('is_deleted', false)
      .maybeSingle();
    if (!before) return NextResponse.json({ error: 'ไม่พบคิว' }, { status: 404 });

    const admin = createAdminClient();
    const { data: rows, error } = await admin.rpc('set_booking_service_minutes', {
      p_shop_id: profile.shop_id, p_booking_id: id, p_minutes: parsed.data.service_minutes, p_actor: user.id,
    });
    if (error) {
      const mapped = dockErrorResponse(error.message);
      if (mapped) return NextResponse.json({ error: mapped.error, code: mapped.code }, { status: mapped.status });
      throw error;
    }
    const row = (rows as Array<{ end_time: string; service_minutes: number }> | null)?.[0];
    if (!row) throw new Error('Duration update failed');

    await logBooking(supabase, {
      companyId: profile.company_id, shopId: profile.shop_id, bookingId: id, action: 'duration_change',
      description: `${before.queue_number}: เวลาที่ท่า ${before.service_minutes ?? '-'} → ${row.service_minutes} นาที`,
      from: { service_minutes: before.service_minutes, end_time: before.end_time },
      to: { service_minutes: row.service_minutes, end_time: row.end_time },
      actorKind: actorFromRoles(roles), actorId: user.id,
    });

    return NextResponse.json({ data: { ok: true, service_minutes: row.service_minutes, end_time: row.end_time } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}
