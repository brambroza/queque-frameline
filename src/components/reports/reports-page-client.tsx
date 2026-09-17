'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Alert, Box, Button, Card, CardContent, ListItemIcon, ListItemText, Menu, MenuItem, Skeleton, Stack } from '@mui/material';
import PictureAsPdfRoundedIcon from '@mui/icons-material/PictureAsPdfRounded';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import TableChartRoundedIcon from '@mui/icons-material/TableChartRounded';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import ListAltRoundedIcon from '@mui/icons-material/ListAltRounded';
import { PageHeader } from '@/components/shared/page-header';
import { useBranchScope } from '@/components/layout/branch-scope-provider';
import { useTranslation } from '@/lib/i18n/useTranslation';
import { getTodayISOInBangkok } from '@/lib/utils/date-format';
import { isISODate, isReportPreset } from '@/lib/reports/range-presets';
import type { ReportData } from '@/types/reports';
import { ReportFilterBar, type ReportFilter } from './report-filter-bar';
import { ReportDocument } from './report-document';
import { ReportPrintSheet } from './report-print-sheet';
import { usePrintReport } from './use-print-report';

function readFilter(params: URLSearchParams): ReportFilter {
  const preset = params.get('preset');
  const today = getTodayISOInBangkok();
  const from = params.get('from');
  const to = params.get('to');
  return {
    preset: isReportPreset(preset) ? preset : 'today',
    from: isISODate(from) ? from : today,
    to: isISODate(to) ? to : today,
  };
}

/**
 * Reports page: one `/api/reports` call per range feeds `ReportDocument`,
 * shown on screen as a paper card and again in the print portal (browser
 * "Save as PDF"), plus the CSV exports. The filter is mirrored into the URL
 * so a view can be shared or refreshed.
 */
export function ReportsPageClient() {
  const { t } = useTranslation('reports');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { branchQuery } = useBranchScope();
  const { printing, print } = usePrintReport();

  const [filter, setFilter] = useState<ReportFilter>(() => readFilter(new URLSearchParams(searchParams.toString())));
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shopRequired, setShopRequired] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [exportAnchor, setExportAnchor] = useState<HTMLElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    params.set('preset', filter.preset);
    if (filter.preset === 'custom') {
      params.set('from', filter.from);
      params.set('to', filter.to);
    }
    if (branchQuery) {
      const b = new URLSearchParams(branchQuery);
      b.forEach((v, k) => params.set(k, v));
    }
    return params.toString();
  }, [filter, branchQuery]);

  // Keep the URL in sync (preset/from/to only) so the view is shareable.
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('preset', filter.preset);
    if (filter.preset === 'custom') {
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
    if (filter.preset === 'custom' && (!isISODate(filter.from) || !isISODate(filter.to))) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);
    setShopRequired(false);
    (async () => {
      try {
        const res = await fetch(`/api/reports?${queryString}`, { cache: 'no-store', signal: controller.signal });
        const json = (await res.json()) as { data?: ReportData; error?: string; code?: string };
        if (json.code === 'SHOP_REQUIRED') {
          setShopRequired(true);
          setData(null);
          return;
        }
        if (!res.ok || !json.data) throw new Error(json.error ?? t('load_failed', 'โหลดรายงานไม่สำเร็จ'));
        setData(json.data);
      } catch (e) {
        if (controller.signal.aborted) return;
        setError(e instanceof Error ? e.message : t('load_failed', 'โหลดรายงานไม่สำเร็จ'));
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [queryString, reloadKey, t, filter.preset, filter.from, filter.to]);

  const handleFilterChange = useCallback((next: ReportFilter) => setFilter(next), []);

  const csvHref = (group: 'day' | 'staff' | 'bookings') => `/api/reports?${queryString}&mode=csv&group=${group}`;
  const canExport = Boolean(data) && !loading;

  return (
    <Stack spacing={2}>
      <PageHeader
        title={t('title', 'รายงาน')}
        description={t('subtitle', 'สรุปคิววันนี้ พรุ่งนี้ ล่วงหน้า และย้อนหลังเพื่อวิเคราะห์ · พิมพ์เป็น PDF หรือ Export CSV')}
        action={
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" startIcon={<DownloadRoundedIcon />} disabled={!canExport} onClick={(e) => setExportAnchor(e.currentTarget)}>
              {t('export_csv', 'Export CSV')}
            </Button>
            <Menu anchorEl={exportAnchor} open={Boolean(exportAnchor)} onClose={() => setExportAnchor(null)}>
              <MenuItem component="a" href={csvHref('day')} onClick={() => setExportAnchor(null)}>
                <ListItemIcon><TableChartRoundedIcon fontSize="small" /></ListItemIcon>
                <ListItemText>{t('export_csv_day', 'สรุปรายวัน')}</ListItemText>
              </MenuItem>
              <MenuItem component="a" href={csvHref('staff')} onClick={() => setExportAnchor(null)}>
                <ListItemIcon><GroupsRoundedIcon fontSize="small" /></ListItemIcon>
                <ListItemText>{t('export_csv_staff', 'รายผู้ให้บริการ')}</ListItemText>
              </MenuItem>
              <MenuItem component="a" href={csvHref('bookings')} onClick={() => setExportAnchor(null)}>
                <ListItemIcon><ListAltRoundedIcon fontSize="small" /></ListItemIcon>
                <ListItemText>{t('export_csv_bookings', 'รายการคิวทั้งหมด')}</ListItemText>
              </MenuItem>
            </Menu>
            <Button variant="contained" startIcon={<PictureAsPdfRoundedIcon />} disabled={!canExport || printing} onClick={print}>
              {t('export_pdf', 'PDF')}
            </Button>
          </Stack>
        }
      />

      <ReportFilterBar value={filter} onChange={handleFilterChange} onRefresh={() => setReloadKey((k) => k + 1)} resolvedFrom={data?.range.from} resolvedTo={data?.range.to} loading={loading} />

      {shopRequired ? <Alert severity="info">{t('pick_shop', 'เลือกร้านจากแถบด้านบนก่อน')}</Alert> : null}

      {error ? (
        <Alert severity="error" action={<Button color="inherit" size="small" onClick={() => setReloadKey((k) => k + 1)}>{t('retry', 'ลองใหม่')}</Button>}>
          {error}
        </Alert>
      ) : null}

      {!data && loading && !shopRequired ? (
        <ReportsSkeleton />
      ) : data ? (
        <Card sx={{ maxWidth: 960, width: '100%', mx: 'auto', opacity: loading ? 0.6 : 1, transition: 'opacity .15s' }}>
          <CardContent sx={{ p: { xs: 2, sm: 4 }, '&:last-child': { pb: { xs: 2, sm: 4 } } }}>
            <ReportDocument data={data} />
          </CardContent>
        </Card>
      ) : null}

      {printing && data && typeof document !== 'undefined' ? createPortal(<ReportPrintSheet data={data} />, document.body) : null}
    </Stack>
  );
}

function ReportsSkeleton() {
  return (
    <Card sx={{ maxWidth: 960, width: '100%', mx: 'auto' }}>
      <CardContent sx={{ p: { xs: 2, sm: 4 } }}>
        <Skeleton width="40%" height={32} />
        <Skeleton width="25%" />
        <Box sx={{ mt: 3 }}><Skeleton width="20%" /><Skeleton /><Skeleton /><Skeleton width="80%" /></Box>
        <Skeleton variant="rounded" height={80} sx={{ mt: 3 }} />
        <Skeleton variant="rounded" height={220} sx={{ mt: 3 }} />
        <Skeleton variant="rounded" height={200} sx={{ mt: 3 }} />
      </CardContent>
    </Card>
  );
}
