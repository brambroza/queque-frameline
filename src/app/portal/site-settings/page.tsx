import { SiteSettingsForm } from '@/components/forms/site-settings-form';
import { requirePageAccess } from '@/lib/auth/page-roles';

export default async function SiteSettingsPage() {
  const { isAdmin } = await requirePageAccess('site_settings');
  return <SiteSettingsForm isAdmin={isAdmin} />;
}
