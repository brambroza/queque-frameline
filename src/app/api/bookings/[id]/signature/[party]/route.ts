import { NextResponse } from 'next/server';
import { requireAuthContext, getErrorStatus } from '@/lib/auth/context';
import { createAdminClient } from '@/lib/supabase/admin';
import { SIGNATURE_BUCKET, isSignatureParty, signatureColumns } from '@/lib/booking/signatures';

/**
 * PNG of one party's close sign-off (`staff` | `customer`). The bucket is
 * private: the bytes are streamed through here after the session and shop
 * are checked, so the image can be an ordinary <img src> in the portal.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string; party: string }> }) {
  try {
    const { supabase, profile } = await requireAuthContext({ roles: ['admin', 'staff'] });
    const { id, party } = await ctx.params;
    if (!isSignatureParty(party)) return NextResponse.json({ error: 'ไม่พบลายเซ็น' }, { status: 404 });
    const cols = signatureColumns(party);
    const { data: row } = await supabase
      .from('bookings')
      .select(`id,${cols.path}`)
      .eq('id', id)
      .eq('shop_id', profile.shop_id)
      .eq('is_deleted', false)
      .maybeSingle();
    const objectPath = (row as Record<string, unknown> | null)?.[cols.path];
    if (typeof objectPath !== 'string' || !objectPath.startsWith(`${profile.shop_id}/`)) {
      return NextResponse.json({ error: 'ไม่พบลายเซ็น' }, { status: 404 });
    }
    const { data: blob, error } = await createAdminClient().storage.from(SIGNATURE_BUCKET).download(objectPath);
    if (error || !blob) return NextResponse.json({ error: 'ไม่พบลายเซ็น' }, { status: 404 });
    return new NextResponse(await blob.arrayBuffer(), {
      status: 200,
      headers: { 'Content-Type': 'image/png', 'Cache-Control': 'private, max-age=300' },
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}
