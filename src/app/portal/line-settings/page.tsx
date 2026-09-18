import { redirect } from 'next/navigation';
import { LineSettingsForm } from '@/components/forms/line-settings-form';
import { getPageRoles } from '@/lib/auth/page-roles';

export default async function LineSettingsPage() {
  const { isAdmin } = await getPageRoles();
  if (!isAdmin) redirect('/portal/dashboard');
  return <LineSettingsForm />;
}
