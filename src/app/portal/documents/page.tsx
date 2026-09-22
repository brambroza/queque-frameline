import { DocumentsCrud } from '@/components/forms/documents-crud';
import { requirePageAccess } from '@/lib/auth/page-roles';

export default async function DocumentsPage() {
  const { isAdmin } = await requirePageAccess('documents');
  return <DocumentsCrud isAdmin={isAdmin} />;
}
