import { NextResponse } from 'next/server';
import { requireAuthContext, getErrorStatus } from '@/lib/auth/context';
import { plateChangeSchema } from '@/lib/booking/schemas';
import { normalizePlate, platesMatch } from '@/lib/booking/plate';
import { actorFromRoles, logBooking } from '@/lib/booking/server';
import { isTerminalStatus } from '@/lib/booking/status-flow';

/**
 * Gate correction: the vehicle that arrived carries a different plate than the
 * one booked. The booked plate is kept; the actual one is stored next to it and audited.
 */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { supabase, user, profile, roles } = await requireAuthContext({ roles: ['admin', 'staff'] });
    const { id } = await ctx.params;
    const parsed = plateChangeSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: 'ทะเบียนรถไม่ถูกต้อง' }, { status: 400 });

    const { data: before } = await supabase
      .from('bookings')
      .select('id,queue_number,status,plate_number,plate_number_actual')
      .eq('id', id)
      .eq('shop_id', profile.shop_id)
      .eq('is_deleted', false)
      .maybeSingle();
    if (!before) return NextResponse.json({ error: 'ไม่พบคิว' }, { status: 404 });
    if (isTerminalStatus(String(before.status))) return NextResponse.json({ error: 'คิวนี้ปิดแล้ว แก้ทะเบียนไม่ได้' }, { status: 409 });

    const next = normalizePlate(parsed.data.plate_number_actual);
    // Typing the booked plate back in clears the correction.
    const actual = platesMatch(next, before.plate_number as string | null) ? null : next;

    const { error } = await supabase
      .from('bookings')
      .update({
        plate_number_actual: actual,
        plate_changed_at: new Date().toISOString(),
        plate_changed_by: user.id,
        updated_by: user.id,
      })
      .eq('id', id)
      .eq('shop_id', profile.shop_id);
    if (error) throw error;

    await logBooking(supabase, {
      companyId: profile.company_id,
      shopId: profile.shop_id,
      bookingId: id,
      action: 'plate_change',
      description: `${before.queue_number ?? id}: ทะเบียน ${before.plate_number_actual ?? before.plate_number ?? '-'} → ${actual ?? before.plate_number}`,
      from: { plate_number: before.plate_number, plate_number_actual: before.plate_number_actual },
      to: { plate_number_actual: actual, reason: parsed.data.reason ?? null },
      actorKind: actorFromRoles(roles),
      actorId: user.id,
    });

    return NextResponse.json({ data: { ok: true, plate_number_actual: actual } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}
