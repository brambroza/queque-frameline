import { SiteSettingsForm } from '@/components/forms/site-settings-form';
import { requirePageAccess } from '@/lib/auth/page-roles';

export default async function SiteSettingsPage() {
  const { canWrite } = await requirePageAccess('site_settings');
  return <SiteSettingsForm isAdmin={canWrite('site_settings')} />;
}
