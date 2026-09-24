import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveDriverToken } from '@/lib/public/resolve';
import { pushSubscribeSchema, pushUnsubscribeSchema } from '@/lib/push/schemas';
import { isPushConfigured } from '@/lib/push/config';
import { logBooking } from '@/lib/booking/server';

/** The driver page subscribed this browser to Web Push for its booking. Idempotent per (booking, endpoint). */
export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  try {
    if (!isPushConfigured()) return NextResponse.json({ error: 'ระบบยังไม่เปิดใช้การแจ้งเตือนผ่านเบราว์เซอร์' }, { status: 503 });
    const { token } = await ctx.params;
    const admin = createAdminClient();
    const resolved = await resolveDriverToken(admin, token);
    if (!resolved.ok) return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    const parsed = pushSubscribeSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: 'ข้อมูลการสมัครรับแจ้งเตือนไม่ถูกต้อง' }, { status: 400 });
    const { booking } = resolved;

    const { data: existing } = await admin
      .from('push_subscriptions')
      .select('id,is_deleted')
      .eq('booking_id', booking.id)
      .eq('endpoint', parsed.data.endpoint)
      .maybeSingle();

    const { error } = await admin
      .from('push_subscriptions')
      .upsert(
        {
          company_id: booking.company_id,
          shop_id: booking.shop_id,
          booking_id: booking.id,
          audience: 'driver',
          endpoint: parsed.data.endpoint,
          p256dh: parsed.data.keys.p256dh,
          auth: parsed.data.keys.auth,
          user_agent: parsed.data.user_agent ?? req.headers.get('user-agent')?.slice(0, 300) ?? null,
          is_deleted: false,
          last_error: null,
        },
        { onConflict: 'booking_id,endpoint' },
      );
    if (error) throw error;

    if (!existing || existing.is_deleted) {
      await logBooking(admin, { companyId: booking.company_id, shopId: booking.shop_id, bookingId: booking.id, action: 'web_push', description: 'คนขับเปิดรับแจ้งเตือนผ่านเบราว์เซอร์', to: { subscribed: true }, actorKind: 'driver' });
    }
    return NextResponse.json({ data: { ok: true } });
  } catch (e) {
    console.error('[public/driver/push]', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาด กรุณาลองใหม่' }, { status: 500 });
  }
}

/** The driver turned browser alerts off on this device. */
export async function DELETE(req: Request, ctx: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await ctx.params;
    const admin = createAdminClient();
    const resolved = await resolveDriverToken(admin, token);
    if (!resolved.ok) return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    const parsed = pushUnsubscribeSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: 'ข้อมูลไม่ถูกต้อง' }, { status: 400 });
    const { booking } = resolved;

    const { error } = await admin
      .from('push_subscriptions')
      .update({ is_deleted: true })
      .eq('booking_id', booking.id)
      .eq('shop_id', booking.shop_id)
      .eq('endpoint', parsed.data.endpoint);
    if (error) throw error;
    return NextResponse.json({ data: { ok: true } });
  } catch (e) {
    console.error('[public/driver/push]', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาด กรุณาลองใหม่' }, { status: 500 });
  }
}
