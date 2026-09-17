import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { readAdminShopCookie, resolveActingShop } from '@/lib/auth/admin-shop-cookie';
import { PortalFrame } from '@/components/layout/portal-frame';

type ShellShop = { id: string; name: string | null; logo_url: string | null; demo_mode_enabled: boolean | null };

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const [{ data: profile }, { data: roleRows }] = await Promise.all([
    supabase.from('users_profile').select('full_name, shop_id, company_id').eq('id', user.id).maybeSingle(),
    supabase.from('user_roles').select('roles(code)').eq('user_id', user.id).eq('is_deleted', false),
  ]);
  const isSuperAdmin = (roleRows ?? []).some((r) => (r.roles as { code?: string } | null)?.code === 'super_admin');

  // A super_admin acts in the shop picked in the topbar (cookie). Same rule as
  // requireAuthContext, so the shell and the APIs agree on which shop is shown.
  let shop: ShellShop | null = null;
  if (isSuperAdmin) {
    const acting = await resolveActingShop(createAdminClient(), await readAdminShopCookie());
    if (acting) shop = { id: acting.id, name: acting.name, logo_url: acting.logo_url, demo_mode_enabled: acting.demo_mode_enabled };
  }

  if (!shop) {
    let resolvedShopId = profile?.shop_id ?? null;
    if (!resolvedShopId) {
      const { data: roleContext } = await supabase
        .from('user_roles')
        .select('shop_id')
        .eq('user_id', user.id)
        .eq('is_deleted', false)
        .not('shop_id', 'is', null)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      resolvedShopId = roleContext?.shop_id ?? null;
    }

    // Fallback: legacy owner accounts may miss profile/user_roles context.
    if (!resolvedShopId) {
      const admin = createAdminClient();
      const { data: createdShop } = await admin
        .from('shops')
        .select('id')
        .eq('created_by', user.id)
        .eq('is_deleted', false)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      resolvedShopId = createdShop?.id ?? null;
    }

    if (resolvedShopId) {
      const { data } = await createAdminClient().from('shops').select('id,name,logo_url,demo_mode_enabled').eq('id', resolvedShopId).maybeSingle();
      shop = (data as ShellShop | null) ?? null;
    }
  }

  const logoUrl = shop?.logo_url ?? null;
  const appVersion = process.env.NEXT_PUBLIC_APP_VERSION || 'v0.1.0';

  return (
    <PortalFrame
      logoUrl={logoUrl}
      shopName={shop?.name}
      fullName={profile?.full_name}
      email={user.email}
      appVersion={appVersion}
      isSuperAdmin={isSuperAdmin}
      demoModeEnabled={Boolean(shop?.demo_mode_enabled)}
      activeShopId={shop?.id ?? null}
    >
      {children}
    </PortalFrame>
  );
}
