import { NextResponse } from 'next/server';
import { requireAuthContext, getErrorStatus } from '@/lib/auth/context';
import { canWriteDocument, isDocType } from '@/lib/auth/document-access';
import { getSiteSettings } from '@/lib/booking/server';
import { getLineConfig, isLineConfigured, liffUrl } from '@/lib/line/config';
import { pushMessage } from '@/lib/line/client';
import { bookingLinkFlex } from '@/lib/line/messages';
import { deriveLinkToken, expiryFromNow, hashToken, tokenState } from '@/lib/tokens';
import { bookingUrl } from '@/lib/links';

/** Push the self-booking link to the partner's LINE (the partner must have linked LINE before). */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuthContext({ roles: ['admin', 'staff'] });
    const { supabase, user, profile } = auth;
    const { id } = await ctx.params;
    const cfg = await getLineConfig(supabase, profile.shop_id);
    if (!isLineConfigured(cfg)) return NextResponse.json({ error: 'ยังไม่ได้ตั้งค่า LINE', code: 'not_configured' }, { status: 409 });

    const { data: doc } = await supabase
      .from('external_documents')
      .select('id,doc_no,doc_type,status,partner_id,partner_name,due_date,booking_token_hash,booking_token_version,booking_token_expires_at,customers(line_user_id,line_users(line_user_id,display_name))')
      .eq('id', id).eq('shop_id', profile.shop_id).eq('is_deleted', false).maybeSingle();
    if (!doc) return NextResponse.json({ error: 'ไม่พบเอกสาร' }, { status: 404 });
    if (!isDocType(doc.doc_type) || !canWriteDocument(doc.doc_type, auth)) return NextResponse.json({ error: 'ไม่มีสิทธิ์ส่งลิงก์จองของเอกสารประเภทนี้' }, { status: 403 });
    if (doc.status === 'cancelled' || doc.status === 'completed') return NextResponse.json({ error: 'เอกสารนี้ปิดแล้ว' }, { status: 409 });

    const partner = doc.customers as unknown as { line_user_id: string | null; line_users: { line_user_id: string; display_name: string | null } | null } | null;
    const to = partner?.line_users?.line_user_id ?? null;
    if (!to) return NextResponse.json({ error: 'คู่ค้ารายนี้ยังไม่ได้ผูก LINE — ส่งลิงก์ให้เปิดผ่าน LINE ครั้งแรกก่อน', code: 'not_linked' }, { status: 409 });

    // Same issue rules as GET booking-link: issue when missing / expired.
    const now = new Date();
    const expired = Boolean(doc.booking_token_hash) && tokenState(doc.booking_token_expires_at as string | null, now) === 'expired';
    const version = Number(doc.booking_token_version ?? 0);
    const token = deriveLinkToken('booking', id, version);
    if (!doc.booking_token_hash || expired) {
      const settings = await getSiteSettings(supabase, profile.shop_id);
      const { error } = await supabase.from('external_documents').update({ booking_token_hash: hashToken(token), booking_token_version: version, booking_token_expires_at: expiryFromNow(now, settings.booking_token_ttl_days), updated_by: user.id }).eq('id', id).eq('shop_id', profile.shop_id);
      if (error) throw error;
    }

    const { data: shop } = await supabase.from('shops').select('name').eq('id', profile.shop_id).maybeSingle();
    const url = liffUrl(cfg, `/book/${token}`) ?? bookingUrl(token);
    try {
      await pushMessage(cfg.channel_access_token, to, [bookingLinkFlex({ docNo: doc.doc_no as string, partnerName: (doc.partner_name as string | null) ?? null, direction: doc.doc_type === 'so' ? 'outbound' : 'inbound', dueDate: doc.due_date as string | null, siteName: (shop?.name as string) || 'Fameline', url })]);
    } catch (e) {
      console.error('[line] send booking link failed:', e instanceof Error ? e.message : e);
      return NextResponse.json({ error: 'ส่ง LINE ไม่สำเร็จ (ผู้รับอาจบล็อก OA หรือโควตาข้อความหมด)', code: 'push_failed' }, { status: 502 });
    }
    return NextResponse.json({ data: { ok: true, to_name: partner?.line_users?.display_name ?? null } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}
