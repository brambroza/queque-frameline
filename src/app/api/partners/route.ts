import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuthContext, getErrorStatus } from '@/lib/auth/context';
import { phoneSchema } from '@/lib/booking/schemas';

const blank = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v);
const partnerSchema = z.object({
  partner_type: z.enum(['customer', 'supplier']),
  code: z.preprocess(blank, z.string().trim().max(60).optional()),
  full_name: z.string().trim().min(1).max(200),
  phone: z.preprocess(blank, phoneSchema.optional()),
  email: z.preprocess(blank, z.string().trim().email().max(200).optional()),
  address: z.preprocess(blank, z.string().trim().max(500).optional()),
  note: z.preprocess(blank, z.string().trim().max(500).optional()),
});

const SELECT = 'id,partner_type,code,full_name,phone,email,address,note,created_at';

function toInt(v: string | null, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

function duplicateMessage(message: string) {
  return message.includes('code') ? 'รหัสคู่ค้านี้ถูกใช้แล้ว' : 'เบอร์โทรนี้ถูกใช้กับคู่ค้ารายอื่นแล้ว';
}

export async function GET(req: Request) {
  try {
    const { supabase, profile } = await requireAuthContext({ roles: ['admin', 'staff'] });
    const sp = new URL(req.url).searchParams;
    const page = toInt(sp.get('page'), 1);
    const pageSize = Math.min(toInt(sp.get('page_size'), 20), 100);
    const from = (page - 1) * pageSize;
    const type = sp.get('partner_type');
    const q = (sp.get('q') ?? '').replace(/[,()%*\\]/g, ' ').trim().slice(0, 60);

    let query = supabase.from('customers').select(SELECT, { count: 'exact' }).eq('shop_id', profile.shop_id).eq('is_deleted', false).order('full_name', { ascending: true });
    if (type === 'customer' || type === 'supplier') query = query.eq('partner_type', type);
    if (q) query = query.or(`full_name.ilike.%${q}%,code.ilike.%${q}%,phone.ilike.%${q}%`);

    const { data, error, count } = await query.range(from, from + pageSize - 1);
    if (error) throw error;
    return NextResponse.json({ data, pagination: { page, page_size: pageSize, total: count ?? 0 } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}

export async function POST(req: Request) {
  try {
    const { supabase, user, profile } = await requireAuthContext({ roles: ['admin'] });
    const parsed = partnerSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: `ข้อมูลไม่ถูกต้อง: ${parsed.error.issues.map((i) => i.path.join('.')).join(', ')}` }, { status: 400 });
    const p = parsed.data;
    const { data, error } = await supabase
      .from('customers')
      .insert({
        company_id: profile.company_id,
        shop_id: profile.shop_id,
        partner_type: p.partner_type,
        code: p.code ?? null,
        full_name: p.full_name,
        phone: p.phone ?? null,
        email: p.email ?? null,
        address: p.address ?? null,
        note: p.note ?? null,
        created_by: user.id,
        updated_by: user.id,
      })
      .select(SELECT)
      .single();
    if (error) {
      if (error.code === '23505') return NextResponse.json({ error: duplicateMessage(error.message) }, { status: 409 });
      throw error;
    }
    return NextResponse.json({ data });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}

export async function PATCH(req: Request) {
  try {
    const { supabase, user, profile } = await requireAuthContext({ roles: ['admin'] });
    const body = (await req.json()) as { id?: unknown };
    const id = z.string().uuid().safeParse(body.id);
    const parsed = partnerSchema.safeParse(body);
    if (!id.success || !parsed.success) return NextResponse.json({ error: 'ข้อมูลไม่ถูกต้อง' }, { status: 400 });
    const p = parsed.data;
    const { data, error } = await supabase
      .from('customers')
      .update({ partner_type: p.partner_type, code: p.code ?? null, full_name: p.full_name, phone: p.phone ?? null, email: p.email ?? null, address: p.address ?? null, note: p.note ?? null, updated_by: user.id })
      .eq('id', id.data)
      .eq('shop_id', profile.shop_id)
      .eq('is_deleted', false)
      .select(SELECT);
    if (error) {
      if (error.code === '23505') return NextResponse.json({ error: duplicateMessage(error.message) }, { status: 409 });
      throw error;
    }
    if (!data || data.length === 0) return NextResponse.json({ error: 'ไม่พบคู่ค้า' }, { status: 404 });
    return NextResponse.json({ data: data[0] });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}

/** Soft delete. History (queues, documents) keeps pointing at the row. */
export async function DELETE(req: Request) {
  try {
    const { supabase, user, profile } = await requireAuthContext({ roles: ['admin'] });
    const id = z.string().uuid().safeParse(new URL(req.url).searchParams.get('id'));
    if (!id.success) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    const { error } = await supabase.from('customers').update({ is_deleted: true, updated_by: user.id }).eq('id', id.data).eq('shop_id', profile.shop_id);
    if (error) throw error;
    return NextResponse.json({ data: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}
