import { VehicleTypesCrud } from '@/components/forms/vehicle-types-crud';
import { getPageRoles } from '@/lib/auth/page-roles';

export default async function VehicleTypesPage() {
  const { isAdmin } = await getPageRoles();
  return <VehicleTypesCrud isAdmin={isAdmin} />;
}
