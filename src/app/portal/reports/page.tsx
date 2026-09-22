import { Suspense } from 'react';
import { ReportsPageClient } from '@/components/reports/reports-page-client';
import { requirePageAccess } from '@/lib/auth/page-roles';

export default async function ReportsPage() {
  await requirePageAccess('reports');
  return (
    <Suspense fallback={null}>
      <ReportsPageClient />
    </Suspense>
  );
}
