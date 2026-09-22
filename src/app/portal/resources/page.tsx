import { DocksCrud } from '@/components/forms/docks-crud';
import { requirePageAccess } from '@/lib/auth/page-roles';

export default async function DocksPage() {
  const { isAdmin } = await requirePageAccess('docks');
  return <DocksCrud isAdmin={isAdmin} />;
}
