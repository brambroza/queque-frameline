import { NotificationsPageClient } from '@/components/notifications/notifications-page-client';
import { requirePageAccess } from '@/lib/auth/page-roles';

export default async function NotificationsPage() {
  await requirePageAccess('notifications');
  return <NotificationsPageClient />;
}
