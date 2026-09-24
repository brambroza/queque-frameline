import { NextResponse } from 'next/server';
import { requireAuthContext, getErrorStatus } from '@/lib/auth/context';
import { canWriteDocument, isDocType } from '@/lib/auth/document-access';
import { getSiteSettings } from '@/lib/booking/server';
import { deriveLinkToken, expiryFromNow, hashToken, tokenState } from '@/lib/tokens';
import { bookingUrl } from '@/lib/links';
import { getLineConfig, liffUrl } from '@/lib/line/config';

/**
 * GET  = the document's self-booking link (issued on first use, re-issued when expired).
 * POST = regenerate: the link already sent to the customer stops working.
 */
async function handle(ctx: { params: Promise<{ id: string }> }, regenerate: boolean) {
  const auth = await requireAuthContext({ roles: ['admin', 'staff'] });
  const { supabase, user, profile } = auth;
  const { id } = await ctx.params;

  const { data: doc } = await supabase
    .from('external_documents')
    .select('id,doc_no,doc_type,status,booking_token_hash,booking_token_version,booking_token_expires_at')
    .eq('id', id)
    .eq('shop_id', profile.shop_id)
    .eq('is_deleted', false)
    .maybeSingle();
  if (!doc) return NextResponse.json({ error: 'ไม่พบเอกสาร' }, { status: 404 });
  // Issuing a link is part of keying the document: admin, sales admin (SO) or purchasing (PO).
  if (!isDocType(doc.doc_type) || !canWriteDocument(doc.doc_type, auth)) return NextResponse.json({ error: 'ไม่มีสิทธิ์ออกลิงก์จองของเอกสารประเภทนี้' }, { status: 403 });
  if (doc.status === 'cancelled' || doc.status === 'completed') {
    return NextResponse.json({ error: 'เอกสารนี้ปิดแล้ว ออกลิงก์จองไม่ได้' }, { status: 409 });
  }

  const now = new Date();
  const expired = Boolean(doc.booking_token_hash) && tokenState(doc.booking_token_expires_at as string | null, now) === 'expired';
  const bump = Boolean(doc.booking_token_hash) && regenerate;
  const version = Number(doc.booking_token_version ?? 0) + (bump ? 1 : 0);
  const token = deriveLinkToken('booking', id, version);
  let expiresAt = (doc.booking_token_expires_at as string | null) ?? null;

  if (!doc.booking_token_hash || regenerate || expired) {
    const settings = await getSiteSettings(supabase, profile.shop_id);
    expiresAt = expiryFromNow(now, settings.booking_token_ttl_days);
    const { error } = await supabase
      .from('external_documents')
      .update({ booking_token_hash: hashToken(token), booking_token_version: version, booking_token_expires_at: expiresAt, updated_by: user.id })
      .eq('id', id)
      .eq('shop_id', profile.shop_id);
    if (error) throw error;
  }
  const line = await getLineConfig(supabase, profile.shop_id);
  return NextResponse.json({ data: { url: bookingUrl(token), liff_url: liffUrl(line, `/book/${token}`), expires_at: expiresAt, doc_no: doc.doc_no } });
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    return await handle(ctx, false);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    return await handle(ctx, true);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}
