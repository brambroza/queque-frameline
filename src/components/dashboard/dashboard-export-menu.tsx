'use client';

import { useCallback, useState } from 'react';
import { Button, CircularProgress, Divider, ListItemIcon, ListItemText, ListSubheader, Menu, MenuItem } from '@mui/material';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import FolderZipRoundedIcon from '@mui/icons-material/FolderZipRounded';
import GridOnRoundedIcon from '@mui/icons-material/GridOnRounded';
import TableChartRoundedIcon from '@mui/icons-material/TableChartRounded';
import { useToast } from '@/components/ui/toast';
import { useTranslation } from '@/lib/i18n/useTranslation';
import { STATUS_LABEL } from '@/components/bookings/booking-types';
import type { BranchOption } from '@/components/layout/branch-scope-provider';
import { buildDashboardSheets, dashboardFileStem, sheetToCsv, type DashboardExportBooking, type ExportSheet, type ExportSheetKey } from '@/lib/dashboard/export';
import type { DashboardData } from '@/types/dashboard';
import { fmt } from './dashboard-utils';
import { buildXlsx, downloadCsv, downloadXlsx, downloadZip } from './dashboard-export';

type ExportChoice =
  | { format: 'xlsx' }
  | { format: 'csv'; sheet: ExportSheetKey }
  | { format: 'xlsx_per_branch' }
  | { format: 'csv_per_branch' };

type BookingsResponse = { data?: { rows: DashboardExportBooking[]; truncated: boolean }; error?: string };
type DashboardResponse = { data?: DashboardData; error?: string };

/** Sheets offered as separate CSV files (CSV holds one table per file). */
const CSV_SHEETS: Array<{ key: ExportSheetKey; label: string; fallback: string }> = [
  { key: 'summary', label: 'export_csv_summary', fallback: 'CSV · สรุป KPI' },
  { key: 'daily', label: 'export_csv_daily', fallback: 'CSV · สรุปรายวัน' },
  { key: 'branches', label: 'export_csv_branches', fallback: 'CSV · เปรียบเทียบสาขา' },
  { key: 'bookings', label: 'export_csv_bookings', fallback: 'CSV · รายการคิวทั้งหมด' },
];

/**
 * "Export" button of the manager dashboard.
 *
 * - Combined: one Excel workbook (every section a sheet, plus the branch
 *   comparison) or one section as CSV, over the branches in view.
 * - Per branch: one file per branch, zipped, each holding that branch alone.
 *
 * Summary sheets of the combined export come from the data on screen; booking
 * lists and per-branch figures are fetched for the export.
 *
 * @param data Dashboard payload currently shown (null while nothing is loaded).
 * @param rangeQuery Range part of the query (`range`, `from`, `to`), without branches.
 * @param branchIds Branches in view; empty = every branch the user may see.
 * @param branches Branches the user may see, for names and the per-branch export.
 */
export function DashboardExportMenu({
  data,
  rangeQuery,
  branchIds,
  branches,
  disabled,
}: {
  data: DashboardData | null;
  rangeQuery: string;
  branchIds: string[];
  branches: BranchOption[];
  disabled?: boolean;
}) {
  const { t } = useTranslation('dashboard');
  const { t: tStatus } = useTranslation('status');
  const { push } = useToast();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');

  const targets = branchIds.length ? branches.filter((b) => branchIds.includes(b.id)) : branches;

  const run = useCallback(
    async (choice: ExportChoice) => {
      setAnchor(null);
      if (!data || busy) return;
      setBusy(true);
      const failed = t('export_failed', 'ส่งออกข้อมูลไม่สำเร็จ');
      const statusLabel = (status: string) => tStatus(status, (STATUS_LABEL as Record<string, string>)[status] ?? status);

      /** Full booking list of the range for the given branch query. */
      const fetchBookings = async (branchQuery: string) => {
        const res = await fetch(`/api/dashboard/export?${rangeQuery}${branchQuery}`, { cache: 'no-store' });
        const json = (await res.json()) as BookingsResponse;
        if (!res.ok || !json.data) throw new Error(json.error ?? failed);
        return json.data;
      };

      try {
        let truncated = false;

        if (choice.format === 'xlsx_per_branch' || choice.format === 'csv_per_branch') {
          const files: Array<{ name: string; data: ArrayBuffer | string }> = [];
          for (const [i, branch] of targets.entries()) {
            setProgress(`${i + 1}/${targets.length}`);
            const branchQuery = `&branch_id=${encodeURIComponent(branch.id)}`;
            const bookings = await fetchBookings(branchQuery);
            truncated = truncated || bookings.truncated;
            const stem = dashboardFileStem(data.range.from, data.range.to, branch.branch_name);

            if (choice.format === 'csv_per_branch') {
              const sheet = buildDashboardSheets({ data, bookings: bookings.rows, t, statusLabel }).find((s) => s.key === 'bookings');
              if (!sheet) throw new Error(failed);
              files.push({ name: `${stem}-bookings.csv`, data: sheetToCsv(sheet) });
              continue;
            }

            const res = await fetch(`/api/dashboard?${rangeQuery}${branchQuery}&recent_limit=1`, { cache: 'no-store' });
            const json = (await res.json()) as DashboardResponse;
            if (!res.ok || !json.data) throw new Error(json.error ?? failed);
            // A single-branch file needs no branch comparison sheet.
            const sheets = buildDashboardSheets({ data: json.data, bookings: bookings.rows, t, statusLabel }).filter((s) => s.key !== 'branches');
            files.push({ name: `${stem}.xlsx`, data: await buildXlsx(sheets) });
          }
          await downloadZip(files, `${dashboardFileStem(data.range.from, data.range.to)}-by-branch.zip`);
        } else {
          const branchQuery = branchIds.length ? `&branch_ids=${branchIds.map(encodeURIComponent).join(',')}` : '';
          let rows: DashboardExportBooking[] = [];
          if (choice.format === 'xlsx' || choice.sheet === 'bookings') {
            const bookings = await fetchBookings(branchQuery);
            rows = bookings.rows;
            truncated = bookings.truncated;
          }
          const sheets: ExportSheet[] = buildDashboardSheets({ data, bookings: rows, t, statusLabel });
          const only = targets.length === 1 && branchIds.length === 1 ? targets[0].branch_name : undefined;
          const stem = dashboardFileStem(data.range.from, data.range.to, only);

          if (choice.format === 'xlsx') {
            await downloadXlsx(sheets, `${stem}.xlsx`);
          } else {
            const sheet = sheets.find((s) => s.key === choice.sheet);
            if (!sheet) throw new Error(failed);
            downloadCsv(sheet, `${stem}-${sheet.key}.csv`);
          }
        }

        if (truncated) push(t('export_truncated', 'รายการคิวมีมากกว่า 10,000 รายการ — ส่งออกเฉพาะ 10,000 รายการแรก กรุณาเลือกช่วงให้แคบลง'), 'error');
        else push(t('export_done', 'ส่งออกข้อมูลแล้ว'));
      } catch (e) {
        push(e instanceof Error ? e.message : failed, 'error');
      } finally {
        setBusy(false);
        setProgress('');
      }
    },
    [data, busy, rangeQuery, branchIds, targets, t, tStatus, push],
  );

  const scopeHint =
    branchIds.length === 0
      ? t('export_scope_all', 'รวมทุกสาขาที่คุณเห็น')
      : fmt(t('export_scope_selected', 'รวม {{count}} สาขาที่เลือก'), { count: targets.length });

  return (
    <>
      <Button
        variant="outlined"
        startIcon={busy ? <CircularProgress size={16} color="inherit" /> : <DownloadRoundedIcon />}
        disabled={disabled || busy || !data}
        onClick={(e) => setAnchor(e.currentTarget)}
        aria-haspopup="menu"
      >
        {busy ? `${t('exporting', 'กำลังส่งออก…')} ${progress}`.trim() : t('export', 'Export')}
      </Button>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
        <ListSubheader sx={{ lineHeight: '32px' }}>{scopeHint}</ListSubheader>
        <MenuItem onClick={() => run({ format: 'xlsx' })}>
          <ListItemIcon><GridOnRoundedIcon fontSize="small" /></ListItemIcon>
          <ListItemText primary={t('export_xlsx', 'Excel (.xlsx)')} secondary={t('export_xlsx_hint', 'ทุกส่วนของแดชบอร์ด แยกแผ่นงาน')} />
        </MenuItem>
        {CSV_SHEETS.map((s) => (
          <MenuItem key={s.key} onClick={() => run({ format: 'csv', sheet: s.key })}>
            <ListItemIcon><TableChartRoundedIcon fontSize="small" /></ListItemIcon>
            <ListItemText>{t(s.label, s.fallback)}</ListItemText>
          </MenuItem>
        ))}
        {targets.length > 1 ? <Divider /> : null}
        {targets.length > 1 ? <ListSubheader sx={{ lineHeight: '32px' }}>{fmt(t('export_per_branch', 'แยกไฟล์ต่อสาขา ({{count}} ไฟล์ ใน .zip)'), { count: targets.length })}</ListSubheader> : null}
        {targets.length > 1 ? (
          <MenuItem onClick={() => run({ format: 'xlsx_per_branch' })}>
            <ListItemIcon><FolderZipRoundedIcon fontSize="small" /></ListItemIcon>
            <ListItemText primary={t('export_xlsx_per_branch', 'Excel สาขาละไฟล์')} secondary={t('export_xlsx_per_branch_hint', 'แต่ละไฟล์มีครบทุกแผ่นของสาขานั้น')} />
          </MenuItem>
        ) : null}
        {targets.length > 1 ? (
          <MenuItem onClick={() => run({ format: 'csv_per_branch' })}>
            <ListItemIcon><FolderZipRoundedIcon fontSize="small" /></ListItemIcon>
            <ListItemText>{t('export_csv_per_branch', 'CSV รายการคิว สาขาละไฟล์')}</ListItemText>
          </MenuItem>
        ) : null}
      </Menu>
    </>
  );
}
