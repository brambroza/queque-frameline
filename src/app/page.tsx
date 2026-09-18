import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { getLineConfig } from '@/lib/line/config';
import { LiffGate } from '@/components/public-booking/liff-gate';

export const dynamic = 'force-dynamic';

/**
 * Site root. Normally straight to the portal; when LINE's LIFF opens the app
 * (`?liff.state=…`) the SDK has to run here first so it can redirect to the
 * booking or driver page the LIFF URL pointed at.
 */
export default async function RootPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  if (sp['liff.state'] !== undefined) {
    const admin = createAdminClient();
    const { data: shop } = await admin.from('shops').select('id').eq('shop_key', process.env.SITE_SHOP_KEY || 'fameline').eq('is_deleted', false).maybeSingle();
    const cfg = shop ? await getLineConfig(admin, shop.id as string) : null;
    if (cfg?.liff_id) return <LiffGate liffId={cfg.liff_id} />;
  }
  redirect('/portal');
}
