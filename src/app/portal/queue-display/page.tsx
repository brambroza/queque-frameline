import { requirePageAccess } from '@/lib/auth/page-roles';
import { PageShell } from '@/components/ui/page-shell';
import { QueueDisplayLinks } from '@/components/display/queue-display-links';

/** Where to find the yard TV page: one URL per branch. */
export default async function QueueDisplayPage() {
  await requirePageAccess('queue_display');
  const base = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/+$/, '');
  const needsKey = Boolean(process.env.DISPLAY_KEY);
  return (
    <PageShell title="จอเรียกคิว" description="เปิดบนทีวีหน้าลานจอดของแต่ละสาขา — แสดงท่า คิวที่ถูกเรียก ทะเบียนรถ และประกาศเสียงภาษาไทย">
      <QueueDisplayLinks base={base} needsKey={needsKey} />
    </PageShell>
  );
}
