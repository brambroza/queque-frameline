import { BookingsCrud } from '@/components/forms/bookings-crud';
import { requirePageAccess } from '@/lib/auth/page-roles';

export default async function BookingsPage() {
  const { isAdmin } = await requirePageAccess('dock_queues');
  return <BookingsCrud isAdmin={isAdmin} />;
}
