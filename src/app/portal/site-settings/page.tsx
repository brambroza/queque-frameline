import { SiteSettingsForm } from '@/components/forms/site-settings-form';
import { getPageRoles } from '@/lib/auth/page-roles';

export default async function SiteSettingsPage() {
  const { isAdmin } = await getPageRoles();
  return <SiteSettingsForm isAdmin={isAdmin} />;
}
