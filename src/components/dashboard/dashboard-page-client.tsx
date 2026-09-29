'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Alert, Box, Button, Card, CardContent, Skeleton, Stack, Tab, Tabs, ToggleButton, ToggleButtonGroup } from '@mui/material';
import { PageHeader } from '@/components/shared/page-header';
import { useBranchScope } from '@/components/layout/branch-scope-provider';
import { useTranslation } from '@/lib/i18n/useTranslation';
import { getNowHourInBangkok, getTodayISOInBangkok } from '@/lib/utils/date-format';
import type { DashboardData, RangeKind } from '@/types/dashboard';
import { DashboardBranchPicker } from './dashboard-branch-picker';
import { DashboardExportMenu } from './dashboard-export-menu';
import { DashboardFilterBar, type DashboardFilter } from './dashboard-filter-bar';
import { DashboardQueuesTab } from './dashboard-queues-tab';
import { DashboardRecentBookings } from './dashboard-recent-bookings';
import { WarehouseTab } from './warehouse/warehouse-tab';

type DashboardTab = 'warehouse' | 'queues';
type Direction = 'all' | 'inbound' | 'outbound';

const RANGE_KINDS: RangeKind[] = ['today', 'week', 'month', 'custom'];
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Branch ids from `?branch_ids=a,b`; anything that is not a uuid is dropped. */
function readBranchIds(params: URLSearchParams): string[] {
  return (params.get('branch_ids') ?? '').split(',').filter((id) => UUID.test(id));
}

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

function readTab(params: URLSearchParams): DashboardTab {
  return params.get('tab') === 'queues' ? 'queues' : 'warehouse';
}

function readDirection(params: URLSearchParams): Direction {
  const d = params.get('direction');
  return d === 'inbound' || d === 'outbound' ? d : 'all';
}

/**
 * Manager dashboard: range, branch and direction filters drive every section
 * through one `/api/dashboard` call. Two tabs share the filters: warehouse KPIs
 * (dock time, delay, dock use) and the queue overview. Filters and tab are
 * mirrored into the URL so a view can be shared or refreshed.
 *
 * Branches: the picker starts on the branch chosen in the top bar and follows it
 * when it changes. A role with "several branches" may tick any number (none =
 * all); a role without it always views exactly one. Export is offered only to
 * roles allowed to export; the API enforces both.
 */
export function DashboardPageClient() {
  const { t } = useTranslation('dashboard');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { loading: branchesLoading, branches, branchId: topBranchId, canExport, multiBranch } = useBranchScope();

  const [filter, setFilter] = useState<DashboardFilter>(() => readFilter(new URLSearchParams(searchParams.toString())));
  const [pickedBranchIds, setPickedBranchIds] = useState<string[]>(() => readBranchIds(new URLSearchParams(searchParams.toString())));
  const [tab, setTab] = useState<DashboardTab>(() => readTab(new URLSearchParams(searchParams.toString())));
  const [direction, setDirection] = useState<Direction>(() => readDirection(new URLSearchParams(searchParams.toString())));
  const [recentPage, setRecentPage] = useState(1);
  const [recentLimit, setRecentLimit] = useState(10);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // True when the API asked for a shop to be selected first (super_admin without an acting shop).
  const [shopRequired, setShopRequired] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  const nowHour = useMemo(() => getNowHourInBangkok(), [data]); // eslint-disable-line react-hooks/exhaustive-deps

  // The top bar's branch switch drives the picker: changing it resets the selection.
  const topBranchSeen = useRef<string | null>(null);
  useEffect(() => {
    if (branchesLoading) return;
    const first = topBranchSeen.current === null;
    const changed = topBranchSeen.current !== topBranchId;
    topBranchSeen.current = topBranchId;
    // First load keeps a selection that came with the link.
    if (first ? pickedBranchIds.length === 0 && topBranchId : changed) {
      setPickedBranchIds(topBranchId ? [topBranchId] : []);
      setRecentPage(1);
    }
  }, [branchesLoading, topBranchId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Selection held to what the role allows: known branches only, and exactly
  // one branch for a role that cannot view several together.
  const branchIds = useMemo(() => {
    const known = pickedBranchIds.filter((id) => branches.some((b) => b.id === id));
    if (multiBranch || branches.length <= 1) return known.length === branches.length ? [] : known;
    return [known[0] ?? branches[0]?.id].filter((id): id is string => Boolean(id));
  }, [pickedBranchIds, branches, multiBranch]);

  const rangeQuery = useMemo(() => {
    const params = new URLSearchParams();
    params.set('range', filter.range);
    if (filter.range === 'custom') {
      params.set('from', filter.from);
      params.set('to', filter.to);
    }
    if (direction !== 'all') params.set('direction', direction);
    return params.toString();
  }, [filter, direction]);

  const queryString = useMemo(() => {
    const params = new URLSearchParams(rangeQuery);
    params.set('recent_page', String(recentPage));
    params.set('recent_limit', String(recentLimit));
    if (branchIds.length) params.set('branch_ids', branchIds.join(','));
    return params.toString();
  }, [rangeQuery, recentPage, recentLimit, branchIds]);

  // Keep the URL in sync (range/from/to + branches) so the view is shareable.
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
    if (direction !== 'all') params.set('direction', direction);
    else params.delete('direction');
    if (tab !== 'warehouse') params.set('tab', tab);
    else params.delete('tab');
    if (!branchesLoading) {
      // One branch equal to the top bar's is already carried by its own `branch_id`.
      if (branchIds.length && !(branchIds.length === 1 && branchIds[0] === topBranchId)) params.set('branch_ids', branchIds.join(','));
      else params.delete('branch_ids');
    }
    const next = params.toString();
    if (next !== searchParams.toString()) router.replace(`${pathname}?${next}`, { scroll: false });
  }, [filter, direction, tab, pathname, router, searchParams, branchIds, branchesLoading, topBranchId]);

  useEffect(() => {
    if (filter.range === 'custom' && (!ISO_DATE.test(filter.from) || !ISO_DATE.test(filter.to))) return;
    // Wait for the branch list: the selection (and what the role allows) depends on it.
    if (branchesLoading) return;
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
  }, [queryString, reloadKey, t, filter.range, filter.from, filter.to, branchesLoading]);

  const handleBranchChange = useCallback((next: string[]) => {
    setPickedBranchIds(next);
    setRecentPage(1);
  }, []);

  const handleFilterChange = useCallback((next: DashboardFilter) => {
    setFilter(next);
    setRecentPage(1);
  }, []);

  const handleDirectionChange = useCallback((next: Direction) => {
    setDirection(next);
    setRecentPage(1);
  }, []);

  return (
    <Stack spacing={2}>
      <PageHeader
        title={t('title', 'แดชบอร์ด')}
        action={canExport ? <DashboardExportMenu data={data} rangeQuery={rangeQuery} branchIds={branchIds} branches={branches} disabled={loading || shopRequired} /> : undefined}
      />
      <DashboardFilterBar
        value={filter}
        onChange={handleFilterChange}
        onRefresh={() => setReloadKey((k) => k + 1)}
        resolvedFrom={data?.range.from}
        resolvedTo={data?.range.to}
        loading={loading}
        branchPicker={
          <>
            {branches.length > 1 ? <DashboardBranchPicker branches={branches} value={branchIds} onChange={handleBranchChange} multi={multiBranch} disabled={branchesLoading} /> : null}
            <ToggleButtonGroup size="small" exclusive value={direction} onChange={(_, next: Direction | null) => next && handleDirectionChange(next)} aria-label={t('direction', 'ประเภทงาน')}>
              <ToggleButton value="all">{t('direction_all', 'ทั้งหมด')}</ToggleButton>
              <ToggleButton value="outbound">{t('direction_outbound_short', 'ขาออก')}</ToggleButton>
              <ToggleButton value="inbound">{t('direction_inbound_short', 'ขาเข้า')}</ToggleButton>
            </ToggleButtonGroup>
          </>
        }
      />

      {shopRequired ? (
        <Alert severity="info">{t('pick_shop', 'เลือกร้านจากแถบด้านบนก่อน')}</Alert>
      ) : null}

      {error ? (
        <Alert severity="error" action={<Button color="inherit" size="small" onClick={() => setReloadKey((k) => k + 1)}>{t('retry', 'ลองใหม่')}</Button>}>
          {error}
        </Alert>
      ) : null}

      {!data && loading && !shopRequired ? (
        <DashboardSkeleton />
      ) : data ? (
        <Stack spacing={2} sx={{ opacity: loading ? 0.6 : 1, transition: 'opacity .15s' }}>
          <Tabs value={tab} onChange={(_, next: DashboardTab) => setTab(next)} sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tab value="warehouse" label={t('tab_warehouse', 'KPI คลัง')} />
            <Tab value="queues" label={t('tab_queues', 'ภาพรวมคิว')} />
          </Tabs>
          {tab === 'warehouse' ? <WarehouseTab data={data} /> : <DashboardQueuesTab data={data} nowHour={nowHour} />}
          <DashboardRecentBookings data={data} onPageChange={setRecentPage} onLimitChange={(v) => { setRecentLimit(v); setRecentPage(1); }} />
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
