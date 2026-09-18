import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuthContext, getErrorStatus } from '@/lib/auth/context';
import { getLineConfig, liffUrl } from '@/lib/line/config';
import { isValidLiffId, normalizeLiffId } from '@/lib/line/liff-id';

const blank = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? null : v);
const schema = z.object({
  channel_access_token: z.preprocess(blank, z.string().trim().min(20).max(400).nullable().optional()),
  channel_secret: z.preprocess(blank, z.string().trim().min(16).max(120).nullable().optional()),
  login_channel_id: z.preprocess(blank, z.string().trim().regex(/^\d{6,20}$/, 'Channel ID เป็นตัวเลข').nullable().optional()),
  liff_id: z.preprocess((v) => { const b = blank(v); return typeof b === 'string' ? normalizeLiffId(b) : b; }, z.string().refine(isValidLiffId, 'LIFF ID ไม่ถูกต้อง (รูปแบบ 1234567890-abcdefgh)').nullable().optional()),
  oa_basic_id: z.preprocess((v) => { const b = blank(v); return typeof b === 'string' ? b.trim().replace(/^@/, '') : b; }, z.string().max(40).nullable().optional()),
  notify_customer: z.boolean().optional(),
  notify_driver: z.boolean().optional(),
  notify_staff_group: z.boolean().optional(),
  /** true = forget the registered group. */
  clear_staff_group: z.boolean().optional(),
});

/** Public shape: secrets are reported as present/absent only. */
async function view(client: Parameters<typeof getLineConfig>[0], shopId: string) {
  const { data: row } = await client.from('line_config').select('channel_access_token,channel_secret,login_channel_id,liff_id,oa_basic_id,staff_group_id,staff_group_name,notify_customer,notify_driver,notify_staff_group,webhook_verified_at,updated_at').eq('shop_id', shopId).maybeSingle();
  const cfg = await getLineConfig(client, shopId);
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/+$/, '');
  return {
    has_token: Boolean(cfg.channel_access_token),
    has_secret: Boolean(cfg.channel_secret),
    token_from_env: !row?.channel_access_token && Boolean(process.env.LINE_CHANNEL_ACCESS_TOKEN),
    login_channel_id: cfg.login_channel_id,
    liff_id: cfg.liff_id,
    oa_basic_id: cfg.oa_basic_id,
    staff_group_id: cfg.staff_group_id,
    staff_group_name: cfg.staff_group_name,
    notify_customer: cfg.notify_customer,
    notify_driver: cfg.notify_driver,
    notify_staff_group: cfg.notify_staff_group,
    webhook_verified_at: cfg.webhook_verified_at,
    webhook_url: `${appUrl}/api/line/webhook`,
    liff_endpoint_url: `${appUrl}/`,
    sample_liff_url: liffUrl(cfg, '/book/<token>'),
    updated_at: (row?.updated_at as string | null) ?? null,
  };
}

export async function GET() {
  try {
    const { supabase, profile } = await requireAuthContext({ roles: ['admin'] });
    return NextResponse.json({ data: await view(supabase, profile.shop_id) });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}

export async function PATCH(req: Request) {
  try {
    const { supabase, user, profile } = await requireAuthContext({ roles: ['admin'] });
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      return NextResponse.json({ error: `${first.path.join('.')}: ${first.message}` }, { status: 400 });
    }
    const { clear_staff_group: clearGroup, ...fields } = parsed.data;
    // Undefined = untouched: an empty token field in the form must not wipe a stored token.
    const patch: Record<string, unknown> = { shop_id: profile.shop_id, company_id: profile.company_id, updated_by: user.id };
    for (const [k, v] of Object.entries(fields)) if (v !== undefined) patch[k] = v;
    if (clearGroup) { patch.staff_group_id = null; patch.staff_group_name = null; }
    const { error } = await supabase.from('line_config').upsert(patch, { onConflict: 'shop_id' });
    if (error) throw error;
    return NextResponse.json({ data: await view(supabase, profile.shop_id) });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}
