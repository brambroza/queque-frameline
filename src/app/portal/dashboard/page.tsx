import { requirePageAccess } from '@/lib/auth/page-roles';
import { Suspense } from 'react';
import { DashboardPageClient } from '@/components/dashboard/dashboard-page-client';

export default async function DashboardPage() {
  await requirePageAccess('dashboard');
  return (
    <Suspense fallback={null}>
      <DashboardPageClient />
    </Suspense>
  );
}
