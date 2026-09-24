import { DocumentsCrud } from '@/components/forms/documents-crud';
import { canWriteDocument } from '@/lib/auth/document-access';
import { requirePageAccess } from '@/lib/auth/page-roles';

/** Sales orders (outbound): keyed by the sales admin, one document at a time. */
export default async function SalesOrdersPage() {
  const page = await requirePageAccess('sales_orders');
  return <DocumentsCrud docType="so" canEdit={canWriteDocument('so', page)} />;
}
