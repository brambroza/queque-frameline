import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuthContext, getErrorStatus } from '@/lib/auth/context';
import { createAdminClient } from '@/lib/supabase/admin';
import { writeAuditLog } from '@/lib/audit/activity-log';

const patchSchema = z.object({ active: z.literal(false) });

/** Revoke a key. There is no un-revoke: issue a new key instead. */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { user, profile } = await requireAuthContext({ roles: ['admin'] });
    const { id } = await ctx.params;
    if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: 'ไม่พบ key' }, { status: 404 });
    const parsed = patchSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: 'ทำได้เฉพาะการเพิกถอน' }, { status: 400 });

    const admin = createAdminClient();
    const { data: key } = await admin.from('api_keys').select('id,name,key_prefix,active').eq('id', id).eq('shop_id', profile.shop_id).eq('is_deleted', false).maybeSingle();
    if (!key) return NextResponse.json({ error: 'ไม่พบ key' }, { status: 404 });
    if (!key.active) return NextResponse.json({ data: { ok: true, already: true } });

    const now = new Date().toISOString();
    const { error } = await admin
      .from('api_keys')
      .update({ active: false, revoked_at: now, revoked_by: user.id, updated_by: user.id })
      .eq('id', id)
      .eq('shop_id', profile.shop_id);
    if (error) throw error;

    await writeAuditLog({
      companyId: profile.company_id, shopId: profile.shop_id, userId: user.id, action: 'api_key_revoked',
      targetTable: 'api_keys', targetId: id, payload: { name: key.name, prefix: key.key_prefix },
    });
    return NextResponse.json({ data: { ok: true } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}
