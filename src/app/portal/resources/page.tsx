import { DocksCrud } from '@/components/forms/docks-crud';
import { getPageRoles } from '@/lib/auth/page-roles';

export default async function DocksPage() {
  const { isAdmin } = await getPageRoles();
  return <DocksCrud isAdmin={isAdmin} />;
}
