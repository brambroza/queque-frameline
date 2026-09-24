import { DocumentsCrud } from '@/components/forms/documents-crud';
import { canWriteDocument } from '@/lib/auth/document-access';
import { requirePageAccess } from '@/lib/auth/page-roles';

/** Purchase orders (inbound): keyed by purchasing, one document at a time. */
export default async function PurchaseOrdersPage() {
  const page = await requirePageAccess('purchase_orders');
  return <DocumentsCrud docType="po" canEdit={canWriteDocument('po', page)} />;
}
