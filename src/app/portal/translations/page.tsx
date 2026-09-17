import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PageShell } from '@/components/ui/page-shell';
import { TranslationsCrud } from '@/components/forms/translations-crud';

export default async function PortalTranslationsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: roleRows } = await supabase
    .from('user_roles')
    .select('roles(code)')
    .eq('user_id', user.id)
    .eq('is_deleted', false);
  const isSuperAdmin = (roleRows ?? []).some((r) => (r.roles as { code?: string } | null)?.code === 'super_admin');
  if (!isSuperAdmin) redirect('/portal/dashboard');

  return (
    <PageShell
      title="Translation Management"
      description="จัดการคำแปลจาก Supabase สำหรับภาษาไทยและอังกฤษ"
    >
      <TranslationsCrud />
    </PageShell>
  );
}

