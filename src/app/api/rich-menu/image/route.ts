import { NextResponse } from 'next/server';
import { requireAuthContext, getErrorStatus } from '@/lib/auth/context';
import { createAdminClient } from '@/lib/supabase/admin';
import { ensureBucket } from '@/lib/storage/buckets';
import { readImageSize } from '@/lib/line/rich-menu/image-size';
import { isAllowedRichMenuSize } from '@/lib/line/rich-menu/layouts';

const SHOP_ASSETS_BUCKET = 'shop-assets';
/** LINE rejects rich menu images above 1 MB. */
const MAX_BYTES = 1_048_576;

/**
 * Save a rendered rich menu image (PNG/JPEG, 2500×1686 or 2500×843, ≤ 1 MB)
 * to the public `shop-assets` bucket and remember its URL on the shop.
 */
export async function POST(req: Request) {
  try {
    const { supabase, user, profile } = await requireAuthContext({ roles: ['super_admin', 'shop_owner'] });
    const form = await req.formData();
    const image = form.get('image');
    if (!(image instanceof File) || image.size === 0) {
      return NextResponse.json({ error: 'ไม่พบไฟล์รูป' }, { status: 400 });
    }
    if (image.size > MAX_BYTES) {
      return NextResponse.json({ error: 'ไฟล์เกิน 1 MB ตามข้อจำกัดของ LINE — ลองใช้สไตล์ Clean หรือบันทึกเป็น JPEG' }, { status: 413 });
    }

    const bytes = new Uint8Array(await image.arrayBuffer());
    const size = readImageSize(bytes);
    if (!size) return NextResponse.json({ error: 'รองรับเฉพาะไฟล์ PNG หรือ JPEG' }, { status: 400 });
    if (!isAllowedRichMenuSize(size.width, size.height)) {
      return NextResponse.json({ error: `ขนาดภาพต้องเป็น 2500×1686 หรือ 2500×843 (ได้ ${size.width}×${size.height})` }, { status: 400 });
    }

    const admin = createAdminClient();
    await ensureBucket(admin, SHOP_ASSETS_BUCKET, { public: true, fileSizeLimit: 5 * 1024 * 1024 });

    const ext = size.mime === 'image/png' ? 'png' : 'jpg';
    const path = `${profile.shop_id}/rich-menu/richmenu-${Date.now()}.${ext}`;
    const { error: uploadError } = await admin.storage.from(SHOP_ASSETS_BUCKET).upload(path, Buffer.from(bytes), {
      upsert: false,
      contentType: size.mime,
    });
    if (uploadError) throw uploadError;

    const { data: publicData } = admin.storage.from(SHOP_ASSETS_BUCKET).getPublicUrl(path);
    const imageUrl = publicData.publicUrl;

    const { error } = await supabase
      .from('shops')
      .update({ rich_menu_image_url: imageUrl, updated_by: user.id })
      .eq('id', profile.shop_id);
    if (error) throw error;

    return NextResponse.json({ data: { image_url: imageUrl, bytes: image.size, width: size.width, height: size.height, mime: size.mime } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}
