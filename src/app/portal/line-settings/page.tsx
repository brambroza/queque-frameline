import { LineSettingsForm } from '@/components/forms/line-settings-form';
import { requirePageAccess } from '@/lib/auth/page-roles';

export default async function LineSettingsPage() {
  await requirePageAccess('line_settings');
  return <LineSettingsForm />;
}
