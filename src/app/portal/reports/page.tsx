import { Suspense } from 'react';
import { ReportsPageClient } from '@/components/reports/reports-page-client';

export default function ReportsPage() {
  return (
    <Suspense fallback={null}>
      <ReportsPageClient />
    </Suspense>
  );
}
