'use client';

import { useCallback, useRef, useState } from 'react';
import { Box, Stack } from '@mui/material';
import type { DashboardData } from '@/types/dashboard';
import { DashboardInsights } from './dashboard-insights';
import { DashboardKpiRow } from './dashboard-kpi-row';
import { DashboardOverviewChart, type OverviewView } from './dashboard-overview-chart';
import { DashboardSideLists } from './dashboard-side-lists';
import { DashboardStatusDonut } from './dashboard-status-donut';
import { DashboardWeekdayPattern } from './dashboard-weekday-pattern';

/** Queue overview tab: bookings against capacity, statuses, vehicle types, branches, patterns. */
export function DashboardQueuesTab({ data, nowHour }: { data: DashboardData; nowHour: number }) {
  const [view, setView] = useState<OverviewView>('density');
  const overviewRef = useRef<HTMLDivElement | null>(null);

  const showTimeline = useCallback(() => {
    setView('timeline');
    overviewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  return (
    <Stack spacing={2}>
      <DashboardKpiRow data={data} />
      <Box ref={overviewRef} sx={{ scrollMarginTop: 80 }}>
        <DashboardOverviewChart data={data} view={view} onViewChange={setView} nowHour={nowHour} />
      </Box>
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr 1fr' }, alignItems: 'start' }}>
        <DashboardStatusDonut byStatus={data.by_status} />
        <DashboardSideLists services={data.popular_services} branches={data.branch_summary} />
      </Box>
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: '3fr 2fr' }, alignItems: 'stretch' }}>
        <DashboardInsights insights={data.insights} today={data.range.today} onShowTimeline={showTimeline} />
        <DashboardWeekdayPattern pattern={data.weekday_pattern} today={data.range.today} />
      </Box>
    </Stack>
  );
}
