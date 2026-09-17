import { BookingsCrud } from '@/components/forms/bookings-crud';
import { getPageRoles } from '@/lib/auth/page-roles';

export default async function BookingsPage() {
  const { isAdmin } = await getPageRoles();
  return <BookingsCrud isAdmin={isAdmin} />;
}
