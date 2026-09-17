import { PageShell } from '@/components/ui/page-shell';
import { SalesInbox } from '@/components/forms/sales-inbox';

export default function SalesInboxPage() {
  return (
    <PageShell title="Sales Inbox" description="คำขออัปเกรดแพ็กเกจและ lead จากเว็บไซต์">
      <SalesInbox />
    </PageShell>
  );
}
