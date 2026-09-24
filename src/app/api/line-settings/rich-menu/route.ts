import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuthContext, getErrorStatus } from '@/lib/auth/context';
import { getLineConfig, isLineConfigured } from '@/lib/line/config';
import { clearDefaultRichMenu, createRichMenu, deleteRichMenu, getDefaultRichMenuId, setDefaultRichMenu, uploadRichMenuImage } from '@/lib/line/client';
import { RICH_MENU_IMAGE_MAX_BYTES, richMenuImageProblem, richMenuRequest } from '@/lib/line/rich-menu';

/** Base64 of a ≤ 1 MB PNG is ≤ ~1.4 MB. */
const schema = z.object({ image_base64: z.string().min(100).max(Math.ceil((RICH_MENU_IMAGE_MAX_BYTES * 4) / 3) + 16) });

function lineFailure(e: unknown): NextResponse {
  const m = e instanceof Error ? e.message : '';
  console.error('[line] rich menu failed:', m);
  const status = / 401:/.test(m) ? 401 : 502;
  return NextResponse.json({ error: status === 401 ? 'Channel access token ไม่ถูกต้องหรือหมดอายุ' : 'เรียก LINE ไม่สำเร็จ กรุณาลองใหม่' }, { status });
}

/**
 * Publish the customer rich menu: create → upload the PNG drawn by the portal
 * → set as the default menu → delete the previously published one. The id is
 * stored in `line_config` so the menu can be replaced or removed later.
 */
export async function POST(req: Request) {
  try {
    const { supabase, user, profile } = await requireAuthContext({ roles: ['admin'] });
    const cfg = await getLineConfig(supabase, profile.shop_id);
    if (!isLineConfigured(cfg)) return NextResponse.json({ error: 'ยังไม่ได้ใส่ Channel access token' }, { status: 409 });

    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: 'ไม่พบภาพเมนู' }, { status: 400 });
    let png: Uint8Array;
    try { png = new Uint8Array(Buffer.from(parsed.data.image_base64, 'base64')); } catch { return NextResponse.json({ error: 'ภาพไม่ถูกต้อง' }, { status: 400 }); }
    const problem = richMenuImageProblem(png);
    if (problem) return NextResponse.json({ error: problem }, { status: 400 });

    const token = cfg.channel_access_token;
    const previous = cfg.rich_menu_id;
    let richMenuId: string;
    try {
      richMenuId = await createRichMenu(token, richMenuRequest());
    } catch (e) {
      return lineFailure(e);
    }
    try {
      await uploadRichMenuImage(token, richMenuId, png);
      await setDefaultRichMenu(token, richMenuId);
    } catch (e) {
      // Do not leave a half-made menu behind on LINE.
      await deleteRichMenu(token, richMenuId).catch(() => undefined);
      return lineFailure(e);
    }
    const publishedAt = new Date().toISOString();
    const { error } = await supabase
      .from('line_config')
      .upsert({ shop_id: profile.shop_id, company_id: profile.company_id, rich_menu_id: richMenuId, rich_menu_published_at: publishedAt, updated_by: user.id }, { onConflict: 'shop_id' });
    if (error) throw error;
    if (previous && previous !== richMenuId) await deleteRichMenu(token, previous).catch((e) => console.error('[line] delete old rich menu failed:', e instanceof Error ? e.message : e));
    return NextResponse.json({ data: { rich_menu_id: richMenuId, rich_menu_published_at: publishedAt } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}

/** Remove the published menu from LINE (default unset + deleted) and forget its id. */
export async function DELETE() {
  try {
    const { supabase, user, profile } = await requireAuthContext({ roles: ['admin'] });
    const cfg = await getLineConfig(supabase, profile.shop_id);
    if (!isLineConfigured(cfg)) return NextResponse.json({ error: 'ยังไม่ได้ใส่ Channel access token' }, { status: 409 });
    const token = cfg.channel_access_token;
    try {
      // Only unset the default when it is ours; a menu made in OA Manager is left alone.
      const current = await getDefaultRichMenuId(token);
      if (cfg.rich_menu_id && current === cfg.rich_menu_id) await clearDefaultRichMenu(token);
      if (cfg.rich_menu_id) await deleteRichMenu(token, cfg.rich_menu_id);
    } catch (e) {
      return lineFailure(e);
    }
    const { error } = await supabase.from('line_config').update({ rich_menu_id: null, rich_menu_published_at: null, updated_by: user.id }).eq('shop_id', profile.shop_id);
    if (error) throw error;
    return NextResponse.json({ data: { rich_menu_id: null, rich_menu_published_at: null } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}
