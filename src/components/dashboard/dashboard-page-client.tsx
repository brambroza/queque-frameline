'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Alert, Box, Button, Card, CardContent, Skeleton, Stack } from '@mui/material';
import { PageHeader } from '@/components/shared/page-header';
import { OnboardingChecklist } from '@/components/dashboard/onboarding-checklist';
import { useBranchScope } from '@/components/layout/branch-scope-provider';
import { useTranslation } from '@/lib/i18n/useTranslation';
import { getNowHourInBangkok, getTodayISOInBangkok } from '@/lib/utils/date-format';
import type { DashboardData, RangeKind } from '@/types/dashboard';
import { DashboardFilterBar, type DashboardFilter } from './dashboard-filter-bar';
import { DashboardKpiRow } from './dashboard-kpi-row';
import { DashboardOverviewChart, type OverviewView } from './dashboard-overview-chart';
import { DashboardRecentBookings } from './dashboard-recent-bookings';
import { DashboardStatusDonut } from './dashboard-status-donut';
import { DashboardSideLists } from './dashboard-side-lists';
import { DashboardInsights } from './dashboard-insights';
import { DashboardWeekdayPattern } from './dashboard-weekday-pattern';

const RANGE_KINDS: RangeKind[] = ['today', 'week', 'month', 'custom'];
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function readFilter(params: URLSearchParams): DashboardFilter {
  const kind = params.get('range');
  const today = getTodayISOInBangkok();
  const from = params.get('from');
  const to = params.get('to');
  return {
    range: RANGE_KINDS.includes(kind as RangeKind) ? (kind as RangeKind) : 'today',
    from: from && ISO_DATE.test(from) ? from : today,
    to: to && ISO_DATE.test(to) ? to : today,
  };
}

/**
 * Manager dashboard: range filter drives every section through one `/api/dashboard`
 * call. The filter is mirrored into the URL so a view can be shared or refreshed.
 */
export function DashboardPageClient() {
  const { t } = useTranslation('dashboard');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { branchQuery } = useBranchScope();

  const [filter, setFilter] = useState<DashboardFilter>(() => readFilter(new URLSearchParams(searchParams.toString())));
  const [view, setView] = useState<OverviewView>('density');
  const [recentPage, setRecentPage] = useState(1);
  const [recentLimit, setRecentLimit] = useState(10);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // True when the API asked for a shop to be selected first (super_admin without an acting shop).
  const [shopRequired, setShopRequired] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const overviewRef = useRef<HTMLDivElement | null>(null);

  const nowHour = useMemo(() => getNowHourInBangkok(), [data]); // eslint-disable-line react-hooks/exhaustive-deps

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    params.set('range', filter.range);
    if (filter.range === 'custom') {
      params.set('from', filter.from);
      params.set('to', filter.to);
    }
    params.set('recent_page', String(recentPage));
    params.set('recent_limit', String(recentLimit));
    if (branchQuery) {
      const b = new URLSearchParams(branchQuery);
      b.forEach((v, k) => params.set(k, v));
    }
    return params.toString();
  }, [filter, recentPage, recentLimit, branchQuery]);

  // Keep the URL in sync (range/from/to only) so the view is shareable.
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('range', filter.range);
    if (filter.range === 'custom') {
      params.set('from', filter.from);
      params.set('to', filter.to);
    } else {
      params.delete('from');
      params.delete('to');
    }
    const next = params.toString();
    if (next !== searchParams.toString()) router.replace(`${pathname}?${next}`, { scroll: false });
  }, [filter, pathname, router, searchParams]);

  useEffect(() => {
    if (filter.range === 'custom' && (!ISO_DATE.test(filter.from) || !ISO_DATE.test(filter.to))) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);
    setShopRequired(false);
    (async () => {
      try {
        const res = await fetch(`/api/dashboard?${queryString}`, { cache: 'no-store', signal: controller.signal });
        const json = (await res.json()) as { data?: DashboardData; error?: string; code?: string };
        if (json.code === 'SHOP_REQUIRED') {
          setShopRequired(true);
          setData(null);
          return;
        }
        if (!res.ok || !json.data) throw new Error(json.error ?? t('load_failed', 'โหลดแดชบอร์ดไม่สำเร็จ'));
        setData(json.data);
      } catch (e) {
        if (controller.signal.aborted) return;
        setError(e instanceof Error ? e.message : t('load_failed', 'โหลดแดชบอร์ดไม่สำเร็จ'));
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [queryString, reloadKey, t, filter.range, filter.from, filter.to]);

  const handleFilterChange = useCallback((next: DashboardFilter) => {
    setFilter(next);
    setRecentPage(1);
  }, []);

  const showTimeline = useCallback(() => {
    setView('timeline');
    overviewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  return (
    <Stack spacing={2}>
      <PageHeader title={t('title', 'แดชบอร์ด')} description={t('subtitle_manager', 'ภาพรวมคิวสำหรับผู้จัดการ')} />
      <OnboardingChecklist />
      <DashboardFilterBar value={filter} onChange={handleFilterChange} onRefresh={() => setReloadKey((k) => k + 1)} resolvedFrom={data?.range.from} resolvedTo={data?.range.to} loading={loading} />

      {shopRequired ? (
        <Alert severity="info">{t('pick_shop', 'เลือกร้านจากแถบด้านบนก่อน')}</Alert>
      ) : null}

      {error ? (
        <Alert severity="error" action={<Button color="inherit" size="small" onClick={() => setReloadKey((k) => k + 1)}>{t('retry', 'ลองใหม่')}</Button>}>
          {error}
        </Alert>
      ) : null}

      {data?.shop_meta.demo_mode_enabled ? (
        <Alert
          severity="info"
          action={
            <Stack direction="row" spacing={1}>
              <Button size="small" href="/portal/line-settings">{t('demo_connect_line', 'เชื่อม LINE OA')}</Button>
              <Button size="small" href="/portal/demo-sandbox">{t('demo_manage', 'จัดการ Demo')}</Button>
              {data.shop_meta.shop_key ? <Button size="small" href={`/display/${encodeURIComponent(data.shop_meta.shop_key)}`}>{t('demo_open_signage', 'เปิด Signage')}</Button> : null}
            </Stack>
          }
        >
          {t('demo_banner', 'โหมดตัวอย่างเปิดอยู่ ข้อมูลนี้ใช้สำหรับทดลองเท่านั้น')} ({data.shop_meta.demo_business_type ?? 'demo'})
        </Alert>
      ) : null}

      {!data && loading && !shopRequired ? (
        <DashboardSkeleton />
      ) : data ? (
        <Stack spacing={2} sx={{ opacity: loading ? 0.6 : 1, transition: 'opacity .15s' }}>
          <DashboardKpiRow data={data} />
          <Box ref={overviewRef} sx={{ scrollMarginTop: 80 }}>
            <DashboardOverviewChart data={data} view={view} onViewChange={setView} nowHour={nowHour} />
          </Box>
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: '7fr 5fr' }, alignItems: 'start' }}>
            <DashboardRecentBookings data={data} onPageChange={setRecentPage} onLimitChange={(v) => { setRecentLimit(v); setRecentPage(1); }} />
            <Stack spacing={2}>
              <DashboardStatusDonut byStatus={data.by_status} />
              <DashboardSideLists services={data.popular_services} branches={data.branch_summary} />
            </Stack>
          </Box>
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: '3fr 2fr' }, alignItems: 'stretch' }}>
            <DashboardInsights insights={data.insights} today={data.range.today} onShowTimeline={showTimeline} />
            <DashboardWeekdayPattern pattern={data.weekday_pattern} today={data.range.today} />
          </Box>
        </Stack>
      ) : null}
    </Stack>
  );
}

function DashboardSkeleton() {
  return (
    <Stack spacing={2}>
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: 'repeat(2,1fr)', sm: 'repeat(3,1fr)', lg: 'repeat(5,1fr)' } }}>
        {Array.from({ length: 5 }, (_, i) => (
          <Card key={i}><CardContent><Skeleton width="60%" /><Skeleton height={36} width="40%" /><Skeleton width="80%" /></CardContent></Card>
        ))}
      </Box>
      <Card><CardContent><Skeleton width={120} /><Skeleton variant="rounded" height={260} sx={{ mt: 1 }} /></CardContent></Card>
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: '7fr 5fr' } }}>
        <Card><CardContent><Skeleton width={140} /><Skeleton variant="rounded" height={280} sx={{ mt: 1 }} /></CardContent></Card>
        <Card><CardContent><Skeleton width={100} /><Skeleton variant="rounded" height={150} sx={{ mt: 1 }} /></CardContent></Card>
      </Box>
    </Stack>
  );
}
