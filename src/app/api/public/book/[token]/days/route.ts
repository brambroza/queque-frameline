import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveBookingToken } from '@/lib/public/resolve';
import { getSiteSettings, resolveDefaultBranchId } from '@/lib/booking/server';
import { addDaysIso, toBangkokStamp } from '@/lib/booking/slot-time';

/** Days the customer may pick: open slots only, after the lead time, inside the booking horizon. */
export async function GET(req: Request, ctx: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await ctx.params;
    const admin = createAdminClient();
    const resolved = await resolveBookingToken(admin, token);
    if (!resolved.ok) return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    const { doc } = resolved;
    const serviceId = z.string().uuid().safeParse(new URL(req.url).searchParams.get('vehicle_type_id'));
    if (!serviceId.success) return NextResponse.json({ error: 'กรุณาเลือกประเภทรถ' }, { status: 400 });

    const now = new Date();
    const settings = await getSiteSettings(admin, doc.shop_id);
    const today = toBangkokStamp(now).date;
    const horizonEnd = addDaysIso(today, settings.booking_horizon_days);
    const branchId = await resolveDefaultBranchId(admin, doc.shop_id);

    // get_available_days caps at 62 days per call; walk the horizon in windows.
    const days: Array<{ day: string; open_slots: number }> = [];
    let from = today;
    while (from <= horizonEnd && days.length < 370) {
      const to = addDaysIso(from, 61) < horizonEnd ? addDaysIso(from, 61) : horizonEnd;
      const { data, error } = await admin.rpc('get_available_days', {
        p_shop_id: doc.shop_id,
        p_branch_id: branchId,
        p_direction: doc.doc_type === 'so' ? 'outbound' : 'inbound',
        p_service_id: serviceId.data,
        p_from: from,
        p_to: to,
        p_not_before: new Date(now.getTime() + settings.booking_lead_min_hours * 3_600_000).toISOString(),
      });
      if (error) throw error;
      days.push(...((data ?? []) as Array<{ day: string; open_slots: number }>));
      from = addDaysIso(to, 1);
    }
    return NextResponse.json({ data: days, meta: { today, horizon_end: horizonEnd } });
  } catch (e) {
    console.error('[public/book/days]', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาด กรุณาลองใหม่' }, { status: 500 });
  }
}
