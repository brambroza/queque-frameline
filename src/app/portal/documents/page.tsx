import { DocumentsCrud } from '@/components/forms/documents-crud';
import { getPageRoles } from '@/lib/auth/page-roles';

export default async function DocumentsPage() {
  const { isAdmin } = await getPageRoles();
  return <DocumentsCrud isAdmin={isAdmin} />;
}
