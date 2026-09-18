import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveBookingToken } from '@/lib/public/resolve';
import { isoDateSchema } from '@/lib/booking/schemas';
import { getSiteSettings, resolveDefaultBranchId } from '@/lib/booking/server';
import { decorateSlots, type SlotRow } from '@/lib/booking/slot-time';

/** Slots of one day, with full / past / too-soon ones flagged so the page can grey them out. */
export async function GET(req: Request, ctx: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await ctx.params;
    const admin = createAdminClient();
    const resolved = await resolveBookingToken(admin, token);
    if (!resolved.ok) return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    const { doc } = resolved;
    const sp = new URL(req.url).searchParams;
    const serviceId = z.string().uuid().safeParse(sp.get('vehicle_type_id'));
    const date = isoDateSchema.safeParse(sp.get('date'));
    if (!serviceId.success || !date.success) return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 });

    const settings = await getSiteSettings(admin, doc.shop_id);
    const { data, error } = await admin.rpc('get_dock_slots', {
      p_shop_id: doc.shop_id,
      p_branch_id: (doc.branch_id ?? (await resolveDefaultBranchId(admin, doc.shop_id))),
      p_direction: doc.doc_type === 'so' ? 'outbound' : 'inbound',
      p_service_id: serviceId.data,
      p_date: date.data,
    });
    if (error) throw error;
    return NextResponse.json({ data: decorateSlots(date.data, (data ?? []) as SlotRow[], new Date(), settings.booking_lead_min_hours) });
  } catch (e) {
    console.error('[public/book/slots]', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาด กรุณาลองใหม่' }, { status: 500 });
  }
}
