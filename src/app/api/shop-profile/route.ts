import { NextResponse } from 'next/server';
import { requireAuthContext, getErrorStatus } from '@/lib/auth/context';
import { createAdminClient } from '@/lib/supabase/admin';

const BUCKET = 'shop-assets';

function extFromFileName(name: string) {
  const p = name.split('.');
  return p.length > 1 ? p[p.length - 1].toLowerCase() : 'png';
}

export async function GET() {
  try {
    const { supabase, profile } = await requireAuthContext({ roles: ['super_admin', 'shop_owner', 'branch_manager', 'staff'] });
    const { data, error } = await supabase
      .from('shops')
      .select('id,company_id,name,shop_key,logo_url,phone,email,address')
      .eq('id', profile.shop_id)
      .single();
    if (error) throw error;
    return NextResponse.json({ data });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}

export async function PATCH(req: Request) {
  try {
    const { supabase, user, profile } = await requireAuthContext({ roles: ['super_admin', 'shop_owner', 'branch_manager'] });
    const form = await req.formData();

    const name = String(form.get('name') ?? '').trim();
    const phone = String(form.get('phone') ?? '').trim() || null;
    const email = String(form.get('email') ?? '').trim() || null;
    const address = String(form.get('address') ?? '').trim() || null;
    const removeLogo = String(form.get('remove_logo') ?? '') === 'true';
    const logo = form.get('logo');

    if (!name) return NextResponse.json({ error: 'Shop name is required' }, { status: 400 });

    let logoUrl: string | null | undefined = undefined;
    const admin = createAdminClient();

    if (removeLogo) {
      logoUrl = null;
    } else if (logo instanceof File && logo.size > 0) {
      const { data: bucket } = await admin.storage.getBucket(BUCKET);
      if (!bucket) {
        const { error: bucketError } = await admin.storage.createBucket(BUCKET, { public: true, fileSizeLimit: 5 * 1024 * 1024 });
        if (bucketError) throw bucketError;
      }

      const ext = extFromFileName(logo.name);
      const path = `${profile.shop_id}/logo-${Date.now()}.${ext}`;
      const bytes = Buffer.from(await logo.arrayBuffer());
      const { error: uploadError } = await admin.storage.from(BUCKET).upload(path, bytes, {
        upsert: true,
        contentType: logo.type || 'image/png',
      });
      if (uploadError) throw uploadError;

      const { data: publicData } = admin.storage.from(BUCKET).getPublicUrl(path);
      logoUrl = publicData.publicUrl;
    }

    const updatePayload: Record<string, unknown> = {
      name,
      phone,
      email,
      address,
      updated_by: user.id,
    };
    if (logoUrl !== undefined) updatePayload.logo_url = logoUrl;

    const { error } = await supabase.from('shops').update(updatePayload).eq('id', profile.shop_id);
    if (error) throw error;
    return NextResponse.json({ data: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}
