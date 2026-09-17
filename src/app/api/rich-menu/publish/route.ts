import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuthContext, getErrorStatus } from '@/lib/auth/context';
import { writeAuditLog } from '@/lib/audit/activity-log';
import { createAdminClient } from '@/lib/supabase/admin';
import { readImageSize } from '@/lib/line/rich-menu/image-size';
import { LAYOUTS } from '@/lib/line/rich-menu/layouts';
import {
  clearDefaultRichMenu,
  createRichMenu,
  deleteRichMenu,
  LineApiError,
  setDefaultRichMenu,
  uploadRichMenuImage,
} from '@/lib/line/rich-menu/line-api';
import { buildRichMenuRequest, RichMenuConfigError } from '@/lib/line/rich-menu/line-request';
import { loadRichMenuShop, parseStoredConfig, toRichMenuState } from '@/lib/line/rich-menu/shop-state';

const BUCKET = 'shop-assets';

const PublishSchema = z.object({ set_default: z.boolean().default(true) });

/** Map LINE / config errors to a response the portal can show. */
function errorResponse(e: unknown) {
  if (e instanceof RichMenuConfigError) return NextResponse.json({ error: e.message }, { status: 400 });
  if (e instanceof LineApiError) {
    if (e.status === 401) return NextResponse.json({ error: 'Channel Access Token ไม่ถูกต้องหรือหมดอายุ — ตรวจสอบที่ LINE Settings' }, { status: 400 });
    return NextResponse.json({ error: `LINE: ${e.message}` }, { status: 502 });
  }
  return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
}

/** Read the saved image bytes back from storage (path derived from the public URL). */
async function fetchStoredImage(imageUrl: string): Promise<Uint8Array> {
  const marker = `/${BUCKET}/`;
  const idx = imageUrl.indexOf(marker);
  if (idx >= 0) {
    const path = decodeURIComponent(imageUrl.slice(idx + marker.length).split('?')[0]);
    const admin = createAdminClient();
    const { data, error } = await admin.storage.from(BUCKET).download(path);
    if (!error && data) return new Uint8Array(await data.arrayBuffer());
  }
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error('ดาวน์โหลดรูป Rich Menu ที่บันทึกไว้ไม่สำเร็จ — กด "บันทึกรูปลงระบบ" ใหม่');
  return new Uint8Array(await res.arrayBuffer());
}

/**
 * Publish the saved config + image to LINE: create rich menu → upload image →
 * set as default for all users → remember the id. The previous menu published
 * by this system is deleted best-effort afterwards.
 */
export async function POST(req: Request) {
  try {
    const { supabase, user, profile } = await requireAuthContext({ roles: ['super_admin', 'shop_owner'] });
    const body = PublishSchema.parse(await req.json().catch(() => ({})));
    const shop = await loadRichMenuShop(supabase, profile.shop_id as string);

    const token = shop.line_channel_access_token;
    if (!token) return NextResponse.json({ error: 'ยังไม่ได้ตั้งค่า Channel Access Token — ตั้งค่าที่ LINE Settings ก่อน' }, { status: 400 });
    const config = parseStoredConfig(shop.rich_menu_config);
    if (!config) return NextResponse.json({ error: 'ยังไม่ได้บันทึกการตั้งค่า Rich Menu' }, { status: 400 });
    if (!shop.rich_menu_image_url) return NextResponse.json({ error: 'ยังไม่ได้บันทึกรูป Rich Menu ลงระบบ' }, { status: 400 });

    const request = buildRichMenuRequest(
      config,
      { shopKey: shop.shop_key ?? '', liffBookingId: shop.liff_id ?? null, liffMemberId: shop.liff_id_login_shop ?? null },
      `QueueBooking – ${shop.name}`,
    );

    const bytes = await fetchStoredImage(shop.rich_menu_image_url);
    const size = readImageSize(bytes);
    const layout = LAYOUTS[config.layout];
    if (!size || size.width !== layout.width || size.height !== layout.height) {
      return NextResponse.json(
        { error: `รูปที่บันทึกไว้ (${size ? `${size.width}×${size.height}` : 'ไม่รู้จัก'}) ไม่ตรงกับเลย์เอาต์ ${layout.width}×${layout.height} — กด "บันทึกรูปลงระบบ" ใหม่` },
        { status: 400 },
      );
    }

    const richMenuId = await createRichMenu(token, request);
    try {
      await uploadRichMenuImage(token, richMenuId, bytes, size.mime);
      if (body.set_default) await setDefaultRichMenu(token, richMenuId);
    } catch (e) {
      // Do not leave a half-configured menu behind on LINE.
      await deleteRichMenu(token, richMenuId).catch(() => undefined);
      throw e;
    }

    const publishedAt = new Date().toISOString();
    const { error } = await supabase
      .from('shops')
      .update({ line_rich_menu_id: richMenuId, rich_menu_published_at: publishedAt, updated_by: user.id })
      .eq('id', profile.shop_id);
    if (error) throw error;

    const previousId = shop.line_rich_menu_id;
    if (previousId && previousId !== richMenuId) {
      await deleteRichMenu(token, previousId).catch((err: unknown) => {
        console.error('[rich_menu_delete_previous_failed]', err instanceof Error ? err.message : err);
      });
    }

    await writeAuditLog({
      companyId: profile.company_id,
      shopId: profile.shop_id,
      userId: user.id,
      action: 'rich_menu_published',
      targetTable: 'shops',
      targetId: profile.shop_id ?? null,
      payload: { rich_menu_id: richMenuId, previous_id: previousId ?? null, set_default: body.set_default, layout: config.layout },
    });

    const after = await loadRichMenuShop(supabase, profile.shop_id as string);
    return NextResponse.json({ data: toRichMenuState(after) });
  } catch (e) {
    return errorResponse(e);
  }
}

/** Unpublish: clear the default menu on LINE, delete ours, forget the id. */
export async function DELETE() {
  try {
    const { supabase, user, profile } = await requireAuthContext({ roles: ['super_admin', 'shop_owner'] });
    const shop = await loadRichMenuShop(supabase, profile.shop_id as string);
    const token = shop.line_channel_access_token;
    if (!token) return NextResponse.json({ error: 'ยังไม่ได้ตั้งค่า Channel Access Token' }, { status: 400 });
    if (!shop.line_rich_menu_id) return NextResponse.json({ error: 'ยังไม่มี Rich Menu ที่เผยแพร่จากระบบ' }, { status: 400 });

    await clearDefaultRichMenu(token).catch((e: unknown) => {
      if (e instanceof LineApiError && e.status === 404) return;
      throw e;
    });
    await deleteRichMenu(token, shop.line_rich_menu_id);

    const { error } = await supabase
      .from('shops')
      .update({ line_rich_menu_id: null, rich_menu_published_at: null, updated_by: user.id })
      .eq('id', profile.shop_id);
    if (error) throw error;

    await writeAuditLog({
      companyId: profile.company_id,
      shopId: profile.shop_id,
      userId: user.id,
      action: 'rich_menu_unpublished',
      targetTable: 'shops',
      targetId: profile.shop_id ?? null,
      payload: { rich_menu_id: shop.line_rich_menu_id },
    });

    const after = await loadRichMenuShop(supabase, profile.shop_id as string);
    return NextResponse.json({ data: toRichMenuState(after) });
  } catch (e) {
    return errorResponse(e);
  }
}
