'use client';

/**
 * @deprecated The dashboard was split into `dashboard-page-client.tsx` and the
 * `dashboard-*` section components. This file only re-exports the page client so
 * old imports keep working; delete it once nothing references it.
 */
export { DashboardPageClient as DashboardCharts } from './dashboard-page-client';
