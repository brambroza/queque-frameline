import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuthContext, getErrorStatus } from '@/lib/auth/context';
import { getSiteSettings } from '@/lib/booking/server';

const int = (min: number, max: number) => z.coerce.number().int().min(min).max(max);

const settingsSchema = z
  .object({
    grace_minutes: int(0, 720),
    early_arrival_minutes: int(0, 1440),
    auto_call_mode: z.enum(['off', 'dock_free', 'time', 'hybrid']),
    auto_call_lead_minutes: int(0, 180),
    called_timeout_minutes: int(1, 240),
    auto_no_show_after_grace: z.coerce.boolean(),
    booking_token_ttl_days: int(1, 90),
    driver_token_ttl_days: int(1, 90),
    booking_lead_min_hours: int(0, 168),
    booking_horizon_days: int(1, 365),
    require_admin_confirm: z.coerce.boolean(),
    driver_self_checkin: z.coerce.boolean(),
    item_minutes_enabled: z.coerce.boolean(),
    minutes_per_item: int(1, 240),
    do_number_format: z
      .string()
      .trim()
      .min(3)
      .max(40)
      .regex(/^[A-Za-z0-9\-_/{}]+$/, 'ใช้ได้เฉพาะ A-Z 0-9 - _ / และ {YYYYMM} {YYYY} {NNNN}')
      .refine((v) => /\{N+\}/.test(v), 'ต้องมีเลขรัน เช่น {NNNN}'),
  })
  .partial();

export async function GET() {
  try {
    const { supabase, profile } = await requireAuthContext({ roles: ['admin', 'staff'] });
    return NextResponse.json({ data: await getSiteSettings(supabase, profile.shop_id) });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}

export async function PATCH(req: Request) {
  try {
    const { supabase, user, profile } = await requireAuthContext({ roles: ['admin'] });
    const parsed = settingsSchema.safeParse(await req.json());
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      return NextResponse.json({ error: `${first.path.join('.')}: ${first.message}` }, { status: 400 });
    }
    const { error } = await supabase
      .from('site_settings')
      .upsert({ shop_id: profile.shop_id, company_id: profile.company_id, ...parsed.data, updated_by: user.id }, { onConflict: 'shop_id' });
    if (error) throw error;
    return NextResponse.json({ data: await getSiteSettings(supabase, profile.shop_id) });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}
