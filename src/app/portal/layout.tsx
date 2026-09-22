import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { PortalFrame } from '@/components/layout/portal-frame';
import { getPageRoles } from '@/lib/auth/page-roles';

type ShellShop = { id: string; name: string | null; logo_url: string | null };

/**
 * Portal shell: resolves the signed-in user's profile and the (single) site
 * shop, then renders the app frame. Unauthenticated visitors go to /login.
 */
export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('users_profile')
    .select('full_name, shop_id, company_id')
    .eq('id', user.id)
    .maybeSingle();

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

  let shop: ShellShop | null = null;
  if (resolvedShopId) {
    const { data } = await createAdminClient().from('shops').select('id,name,logo_url').eq('id', resolvedShopId).maybeSingle();
    shop = (data as ShellShop | null) ?? null;
  }

  const appVersion = process.env.NEXT_PUBLIC_APP_VERSION || 'v0.1.0';
  const { access } = await getPageRoles();

  return (
    <PortalFrame
      logoUrl={shop?.logo_url ?? null}
      shopName={shop?.name}
      fullName={profile?.full_name}
      email={user.email}
      appVersion={appVersion}
      access={access}
    >
      {children}
    </PortalFrame>
  );
}
