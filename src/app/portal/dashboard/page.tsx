import { Suspense } from 'react';
import { DashboardPageClient } from '@/components/dashboard/dashboard-page-client';

export default async function DashboardPage() {
  return (
    <Suspense fallback={null}>
      <DashboardPageClient />
    </Suspense>
  );
}
