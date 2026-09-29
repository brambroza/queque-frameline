import { ActivityLogsView } from '@/components/forms/activity-logs-view';
import { requirePageAccess } from '@/lib/auth/page-roles';

export default async function ActivityLogsPage() {
  await requirePageAccess('activity_logs');
  return <ActivityLogsView />;
}
