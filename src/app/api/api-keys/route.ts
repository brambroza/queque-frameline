import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuthContext, getErrorStatus } from '@/lib/auth/context';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateApiKey } from '@/lib/tokens';
import { writeAuditLog } from '@/lib/audit/activity-log';

const KEY_SELECT ='id,name,key_prefix,scopes,last_used_at,last_used_ip,active,created_at,revoked_at';

const MAX_ACTIVE_KEYS = 10;

const createSchema = z.object({
  name: z.string().trim().min(2).max(80),
  scopes: z.array(z.enum(['documents:write'])).min(1).default(['documents:write']),
});

/** API keys of the site (hash never leaves the DB). Admin only. */
export async function GET() {
  try {
    const { supabase, profile } = await requireAuthContext({ roles: ['admin'] });
    const { data, error } = await supabase
      .from('api_keys')
      .select(KEY_SELECT)
      .eq('shop_id', profile.shop_id)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return NextResponse.json({ data: data ?? [] });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}

/** Create a key. The raw value is returned here once and never again. */
export async function POST(req: Request) {
  try {
    const { user, profile } = await requireAuthContext({ roles: ['admin'] });
    const parsed = createSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: 'ชื่อ key ต้องยาว 2–80 ตัวอักษร' }, { status: 400 });

    // RLS on api_keys is read-only for the session; writes go through the service role after the admin check above.
    const admin = createAdminClient();
    const { count } = await admin.from('api_keys').select('id', { count: 'exact', head: true }).eq('shop_id', profile.shop_id).eq('is_deleted', false).eq('active', true);
    if ((count ?? 0) >= MAX_ACTIVE_KEYS) return NextResponse.json({ error: `มี key ที่ใช้งานอยู่ครบ ${MAX_ACTIVE_KEYS} รายการแล้ว เพิกถอนอันเก่าก่อน` }, { status: 409 });

    const key = generateApiKey();
    const { data, error } = await admin
      .from('api_keys')
      .insert({
        company_id: profile.company_id,
        shop_id: profile.shop_id,
        name: parsed.data.name,
        key_hash: key.hash,
        key_prefix: key.prefix,
        scopes: parsed.data.scopes,
        created_by: user.id,
        updated_by: user.id,
      })
      .select(KEY_SELECT)
      .single();
    if (error || !data) throw error ?? new Error('insert failed');

    await writeAuditLog({
      companyId: profile.company_id, shopId: profile.shop_id, userId: user.id, action: 'api_key_created',
      targetTable: 'api_keys', targetId: data.id as string, payload: { name: parsed.data.name, prefix: key.prefix, scopes: parsed.data.scopes },
    });

    return NextResponse.json({ data: { ...data, raw_key: key.raw } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}
