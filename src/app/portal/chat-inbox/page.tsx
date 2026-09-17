import { PageShell } from '@/components/ui/page-shell';
import { ChatInboxClient } from '@/components/line/chat-inbox-client';

export default function ChatInboxPage() {
  return (
    <PageShell title="Chat Inbox" description="ดูและตอบข้อความ LINE ของลูกค้า">
      <ChatInboxClient />
    </PageShell>
  );
}
