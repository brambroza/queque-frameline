import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuthContext, getErrorStatus } from '@/lib/auth/context';
import { writeAuditLog } from '@/lib/audit/activity-log';

const settingSchema = z.object({
  key: z.string().min(2),
  value: z.unknown(),
});
const RESERVED_SETTING_KEYS = new Set(['google_calendar_oauth']);

function toInt(v: string | null, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

export async function GET(req: Request) {
  try {
    const { supabase, profile } = await requireAuthContext({ roles: ['super_admin', 'shop_owner', 'branch_manager', 'staff'] });
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q');
    const page = toInt(searchParams.get('page'), 1);
    const pageSize = Math.min(toInt(searchParams.get('page_size'), 20), 100);

    let query = supabase
      .from('settings')
      .select('id,key,value,created_at,updated_at', { count: 'exact' })
      .eq('shop_id', profile.shop_id)
      .eq('is_deleted', false)
      .neq('key', 'google_calendar_oauth')
      .order('created_at', { ascending: false });

    if (q) query = query.ilike('key', `%${q}%`);

    const from = (page - 1) * pageSize;
    const { data, error, count } = await query.range(from, from + pageSize - 1);
    if (error) throw error;

    return NextResponse.json({ data: data ?? [], pagination: { page, page_size: pageSize, total: count ?? 0 } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}

export async function POST(req: Request) {
  try {
    const { supabase, user, profile } = await requireAuthContext({ roles: ['super_admin', 'shop_owner', 'branch_manager'] });
    const body = await req.json();
    const parsed = settingSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: 'Invalid payload', issues: parsed.error.issues }, { status: 400 });

    const payload = parsed.data;
    if (RESERVED_SETTING_KEYS.has(payload.key)) {
      return NextResponse.json({ error: 'Reserved setting key' }, { status: 400 });
    }

    const { error } = await supabase.from('settings').insert({
      company_id: profile.company_id,
      shop_id: profile.shop_id,
      key: payload.key,
      value: payload.value,
      created_by: user.id,
      updated_by: user.id,
    });

    if (error) throw error;
    return NextResponse.json({ data: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}

export async function PATCH(req: Request) {
  try {
    const { supabase, user, profile } = await requireAuthContext({ roles: ['super_admin', 'shop_owner', 'branch_manager'] });
    const body = await req.json();
    const id = body.id as string;
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const parsed = settingSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: 'Invalid payload', issues: parsed.error.issues }, { status: 400 });

    const payload = parsed.data;
    if (RESERVED_SETTING_KEYS.has(payload.key)) {
      return NextResponse.json({ error: 'Reserved setting key' }, { status: 400 });
    }

    const { error } = await supabase
      .from('settings')
      .update({
        key: payload.key,
        value: payload.value,
        updated_by: user.id,
      })
      .eq('id', id)
      .eq('shop_id', profile.shop_id);

    if (error) throw error;
    await writeAuditLog({
      companyId: profile.company_id,
      shopId: profile.shop_id,
      userId: user.id,
      action: 'data_deleted',
      targetTable: 'settings',
      targetId: id,
      payload: { soft_delete: true },
    });
    return NextResponse.json({ data: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}

export async function DELETE(req: Request) {
  try {
    const { supabase, user, profile } = await requireAuthContext({ roles: ['super_admin', 'shop_owner'] });
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const { error } = await supabase
      .from('settings')
      .update({ is_deleted: true, updated_by: user.id })
      .eq('id', id)
      .eq('shop_id', profile.shop_id)
      .neq('key', 'google_calendar_oauth');

    if (error) throw error;
    return NextResponse.json({ data: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}
