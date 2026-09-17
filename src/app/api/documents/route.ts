import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuthContext, getErrorStatus } from '@/lib/auth/context';
import { documentUpsertSchema } from '@/lib/integration/schemas';
import { upsertDocument } from '@/lib/integration/upsert';

const DOC_SELECT =
  'id,doc_type,doc_no,partner_id,partner_code,partner_name,doc_date,due_date,status,source,items,total_qty,remark,booking_token_hash,booking_token_expires_at,imported_at,updated_at';

function toInt(v: string | null, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

const createSchema = documentUpsertSchema.extend({ doc_type: z.enum(['so', 'po']) });

/** SO / PO list. `q` matches doc no or partner; `bookable=1` = open/booked only (create-queue picker). */
export async function GET(req: Request) {
  try {
    const { supabase, profile } = await requireAuthContext({ roles: ['admin', 'staff'] });
    const sp = new URL(req.url).searchParams;
    const page = toInt(sp.get('page'), 1);
    const pageSize = Math.min(toInt(sp.get('page_size'), 20), 100);
    const from = (page - 1) * pageSize;

    let query = supabase
      .from('external_documents')
      .select(DOC_SELECT, { count: 'exact' })
      .eq('shop_id', profile.shop_id)
      .eq('is_deleted', false)
      .order('imported_at', { ascending: false });

    const docType = sp.get('doc_type');
    const status = sp.get('status');
    const q = (sp.get('q') ?? '').replace(/[,()%*\\]/g, ' ').trim().slice(0, 60);
    if (docType === 'so' || docType === 'po') query = query.eq('doc_type', docType);
    if (status) query = query.eq('status', status);
    if (sp.get('bookable') === '1') query = query.in('status', ['open', 'booked']);
    if (q) query = query.or(`doc_no.ilike.%${q}%,partner_name.ilike.%${q}%,partner_code.ilike.%${q}%`);

    const { data, error, count } = await query.range(from, from + pageSize - 1);
    if (error) throw error;

    // Live queue count per document, one query for the page.
    const ids = (data ?? []).map((d) => d.id as string);
    const counts = new Map<string, number>();
    if (ids.length > 0) {
      const { data: bookings } = await supabase
        .from('bookings')
        .select('document_id,status')
        .eq('shop_id', profile.shop_id)
        .eq('is_deleted', false)
        .in('document_id', ids)
        .not('status', 'in', '(cancelled,no_show)');
      (bookings ?? []).forEach((b) => counts.set(b.document_id as string, (counts.get(b.document_id as string) ?? 0) + 1));
    }

    return NextResponse.json({
      data: (data ?? []).map(({ booking_token_hash, ...d }) => ({ ...d, has_link: Boolean(booking_token_hash), booking_count: counts.get(d.id as string) ?? 0 })),
      pagination: { page, page_size: pageSize, total: count ?? 0 },
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}

/** Create / update one document by hand (`source = manual`). */
export async function POST(req: Request) {
  try {
    const { supabase, user, profile } = await requireAuthContext({ roles: ['admin'] });
    const parsed = createSchema.safeParse(await req.json());
    if (!parsed.success) {
      const fields = Array.from(new Set(parsed.error.issues.map((i) => i.path.join('.'))));
      return NextResponse.json({ error: `ข้อมูลไม่ถูกต้อง: ${fields.join(', ')}` }, { status: 400 });
    }
    const { doc_type: docType, ...doc } = parsed.data;
    const outcome = await upsertDocument(supabase, { shopId: profile.shop_id, companyId: profile.company_id }, docType, 'manual', doc, user.id);
    if (!outcome.ok) return NextResponse.json({ error: outcome.message, code: outcome.code }, { status: outcome.code === 'has_live_bookings' ? 409 : 400 });
    return NextResponse.json({ data: outcome });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}
