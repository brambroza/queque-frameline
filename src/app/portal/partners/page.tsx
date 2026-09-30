import { PartnersCrud } from '@/components/forms/partners-crud';
import { requirePageAccess } from '@/lib/auth/page-roles';

export default async function PartnersPage() {
  const { canManage } = await requirePageAccess('partners');
  return <PartnersCrud isAdmin={canManage} />;
}
