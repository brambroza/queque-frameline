import { PartnersCrud } from '@/components/forms/partners-crud';
import { getPageRoles } from '@/lib/auth/page-roles';

export default async function PartnersPage() {
  const { isAdmin } = await getPageRoles();
  return <PartnersCrud isAdmin={isAdmin} />;
}
