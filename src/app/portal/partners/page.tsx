import { PartnersCrud } from '@/components/forms/partners-crud';
import { canWritePartner } from '@/lib/auth/document-access';
import { requirePageAccess } from '@/lib/auth/page-roles';

/** Partners: customers (SO) and suppliers (PO). Sales may maintain customers, purchasing suppliers, admin / manager both. */
export default async function PartnersPage() {
  const page = await requirePageAccess('partners');
  return <PartnersCrud canWrite={{ customer: canWritePartner('customer', page), supplier: canWritePartner('supplier', page) }} />;
}
