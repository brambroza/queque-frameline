import { VehicleTypesCrud } from '@/components/forms/vehicle-types-crud';
import { requirePageAccess } from '@/lib/auth/page-roles';

export default async function VehicleTypesPage() {
  const { isAdmin } = await requirePageAccess('vehicle_types');
  return <VehicleTypesCrud isAdmin={isAdmin} />;
}
