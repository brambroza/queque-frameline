import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveBookingToken } from '@/lib/public/resolve';
import { bindLineUser } from '@/lib/line/bind';

const schema = z.object({ id_token: z.string().min(20).max(4000) });

/** The customer / supplier opened their booking link inside LINE: bind their LINE user to the partner and this document's queues. */
export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await ctx.params;
    const admin = createAdminClient();
    const resolved = await resolveBookingToken(admin, token);
    if (!resolved.ok) return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: 'ข้อมูลไม่ถูกต้อง' }, { status: 400 });
    const { doc } = resolved;
    const r = await bindLineUser(admin, { shopId: doc.shop_id, companyId: doc.company_id }, parsed.data.id_token, { kind: 'partner', partnerId: doc.partner_id, documentId: doc.id });
    if (!r.ok) return NextResponse.json({ error: r.reason === 'invalid_token' ? 'ยืนยันตัวตน LINE ไม่สำเร็จ กรุณาเปิดลิงก์ใหม่' : 'ระบบยังไม่เปิดใช้ LINE', code: r.reason }, { status: r.reason === 'invalid_token' ? 401 : 503 });
    return NextResponse.json({ data: { display_name: r.displayName } });
  } catch (e) {
    console.error('[public/book/line-link]', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาด กรุณาลองใหม่' }, { status: 500 });
  }
}
