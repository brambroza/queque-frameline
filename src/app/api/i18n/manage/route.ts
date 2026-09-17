import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuthContext, getErrorStatus } from '@/lib/auth/context';
import { createAdminClient } from '@/lib/supabase/admin';

const upsertSchema = z.object({
  id: z.string().uuid().optional(),
  namespace_id: z.string().uuid(),
  language_code: z.string().min(2),
  translation_key: z.string().min(1),
  translation_value: z.string().min(1),
  description: z.string().optional().nullable(),
  active: z.boolean().optional(),
});

function toInt(v: string | null, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

export async function GET(req: Request) {
  try {
    await requireAuthContext({ roles: ['super_admin'] });
    const admin = createAdminClient();
    const { searchParams } = new URL(req.url);
    const language = searchParams.get('language');
    const namespace = searchParams.get('namespace');
    const q = searchParams.get('q');
    const active = searchParams.get('active');
    const page = toInt(searchParams.get('page'), 1);
    const pageSize = Math.min(toInt(searchParams.get('page_size'), 20), 100);

    let query = admin
      .from('translations')
      .select('id,namespace_id,language_code,translation_key,translation_value,description,active,updated_at,translation_namespaces!inner(code,name)', { count: 'exact' })
      .order('updated_at', { ascending: false });

    if (language) query = query.eq('language_code', language);
    if (namespace) query = query.eq('translation_namespaces.code', namespace);
    if (q) query = query.or(`translation_key.ilike.%${q}%,translation_value.ilike.%${q}%`);
    if (active === 'true' || active === 'false') query = query.eq('active', active === 'true');

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
    const { user } = await requireAuthContext({ roles: ['super_admin'] });
    const admin = createAdminClient();
    const parsed = upsertSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    const payload = parsed.data;

    const { error } = await admin.from('translations').insert({
      namespace_id: payload.namespace_id,
      language_code: payload.language_code,
      translation_key: payload.translation_key,
      translation_value: payload.translation_value,
      description: payload.description ?? null,
      active: payload.active ?? true,
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
    const { user } = await requireAuthContext({ roles: ['super_admin'] });
    const admin = createAdminClient();
    const parsed = upsertSchema.safeParse(await req.json());
    if (!parsed.success || !parsed.data.id) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    const payload = parsed.data;

    const { error } = await admin
      .from('translations')
      .update({
        namespace_id: payload.namespace_id,
        language_code: payload.language_code,
        translation_key: payload.translation_key,
        translation_value: payload.translation_value,
        description: payload.description ?? null,
        active: payload.active ?? true,
        updated_by: user.id,
      })
      .eq('id', payload.id);
    if (error) throw error;
    return NextResponse.json({ data: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}

export async function DELETE(req: Request) {
  try {
    const { user } = await requireAuthContext({ roles: ['super_admin'] });
    const admin = createAdminClient();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const { error } = await admin
      .from('translations')
      .update({ active: false, updated_by: user.id })
      .eq('id', id);
    if (error) throw error;
    return NextResponse.json({ data: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}
