import { PageShell } from '@/components/ui/page-shell';
import { TranslationsCrud } from '@/components/forms/translations-crud';
import { requirePageAccess } from '@/lib/auth/page-roles';

export default async function PortalTranslationsPage() {
  await requirePageAccess('translations');

  return (
    <PageShell
      title="Translation Management"
      description="จัดการคำแปลจาก Supabase สำหรับภาษาไทยและอังกฤษ"
    >
      <TranslationsCrud />
    </PageShell>
  );
}
