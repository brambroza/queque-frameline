'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Alert, Box, Button, Card, Chip, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Skeleton, Stack, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, TextField, Typography,
} from '@mui/material';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { TablePaginationControls } from '@/components/ui/table-pagination-controls';
import { ACTIVITY_OP_LABELS, ACTIVITY_TABLES, opOfAction, summarizePayload, tableLabel, type ActivityOp } from '@/lib/audit/activity-view';
import { formatDateTimeDMY } from '@/lib/utils/date-format';

type Row = {
  id: string;
  user_id: string | null;
  user_name: string | null;
  action: string;
  target_table: string | null;
  target_id: string | null;
  payload: unknown;
  created_at: string;
};
type UserOption = { id: string; name: string };
type Filters = { op: string; table: string; userId: string; from: string; to: string };

const EMPTY_FILTERS: Filters = { op: '', table: '', userId: '', from: '', to: '' };
const LOAD_ERROR = 'โหลดประวัติไม่สำเร็จ';

const OP_COLOR: Record<ActivityOp, 'success' | 'info' | 'error' | 'default'> = {
  create: 'success',
  update: 'info',
  delete: 'error',
  other: 'default',
};

/** Pretty JSON for the detail dialog; never throws on odd payloads. */
function payloadText(payload: unknown): string {
  try {
    return JSON.stringify(payload ?? {}, null, 2);
  } catch {
    return '{}';
  }
}

/** Read-only audit trail: who added, changed or removed what, and when. */
export function ActivityLogsView() {
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<Row | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const query = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
      if (filters.op) query.set('op', filters.op);
      if (filters.table) query.set('table', filters.table);
      if (filters.userId) query.set('user_id', filters.userId);
      if (filters.from) query.set('from', filters.from);
      if (filters.to) query.set('to', filters.to);
      const res = await fetch(`/api/activity-logs?${query}`, { cache: 'no-store' });
      const j = (await res.json()) as { data?: Row[]; users?: UserOption[]; pagination?: { total: number }; error?: string };
      if (!res.ok) throw new Error(j.error ?? LOAD_ERROR);
      setRows(j.data ?? []);
      setUsers(j.users ?? []);
      setTotal(j.pagination?.total ?? 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : LOAD_ERROR);
      setRows((prev) => prev ?? []);
    }
  }, [filters, page, pageSize]);

  useEffect(() => { void load(); }, [load]);

  function change(patch: Partial<Filters>) {
    setFilters((prev) => ({ ...prev, ...patch }));
    setPage(1);
  }

  const filtered = Object.values(filters).some(Boolean);

  return (
    <Stack spacing={2}>
      <PageHeader
        title="ประวัติการใช้งาน"
        description="ใครเพิ่ม แก้ไข หรือลบข้อมูลอะไร เมื่อไร"
        action={<Button variant="outlined" startIcon={<RefreshRoundedIcon />} onClick={() => void load()}>รีเฟรช</Button>}
      />
      <Card>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ p: 2 }} alignItems={{ md: 'center' }} flexWrap="wrap" useFlexGap>
          <TextField select size="small" label="การกระทำ" value={filters.op} onChange={(e) => change({ op: e.target.value })} sx={{ minWidth: 140 }}>
            <MenuItem value="">ทั้งหมด</MenuItem>
            {(Object.keys(ACTIVITY_OP_LABELS) as ActivityOp[]).map((op) => <MenuItem key={op} value={op}>{ACTIVITY_OP_LABELS[op]}</MenuItem>)}
          </TextField>
          <TextField select size="small" label="ข้อมูล" value={filters.table} onChange={(e) => change({ table: e.target.value })} sx={{ minWidth: 200 }}>
            <MenuItem value="">ทั้งหมด</MenuItem>
            {ACTIVITY_TABLES.map((t) => <MenuItem key={t.table} value={t.table}>{t.label}</MenuItem>)}
          </TextField>
          <TextField select size="small" label="ผู้ใช้" value={filters.userId} onChange={(e) => change({ userId: e.target.value })} sx={{ minWidth: 200 }}>
            <MenuItem value="">ทั้งหมด</MenuItem>
            {users.map((u) => <MenuItem key={u.id} value={u.id}>{u.name}</MenuItem>)}
          </TextField>
          <TextField type="date" size="small" label="ตั้งแต่" value={filters.from} onChange={(e) => change({ from: e.target.value })} slotProps={{ inputLabel: { shrink: true } }} />
          <TextField type="date" size="small" label="ถึง" value={filters.to} onChange={(e) => change({ to: e.target.value })} slotProps={{ inputLabel: { shrink: true } }} />
          {filtered ? <Button size="small" onClick={() => { setFilters(EMPTY_FILTERS); setPage(1); }}>ล้างตัวกรอง</Button> : null}
        </Stack>

        {error ? <Alert severity="error" sx={{ mx: 2, mb: 2 }} action={<Button color="inherit" size="small" onClick={() => void load()}>ลองใหม่</Button>}>{error}</Alert> : null}

        {rows === null ? (
          <Stack spacing={1} sx={{ p: 2 }}>{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} variant="rounded" height={44} />)}</Stack>
        ) : rows.length === 0 ? (
          error ? null : <EmptyState icon="🗂️" title={filtered ? 'ไม่พบประวัติตามตัวกรอง' : 'ยังไม่มีประวัติ'} />
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>เวลา</TableCell><TableCell>ผู้ใช้</TableCell><TableCell>การกระทำ</TableCell><TableCell>ข้อมูล</TableCell><TableCell>รายละเอียด</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((r) => {
                  const op = opOfAction(r.action);
                  return (
                    <TableRow key={r.id} hover onClick={() => setDetail(r)} sx={{ cursor: 'pointer' }}>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDateTimeDMY(r.created_at)}</TableCell>
                      <TableCell>{r.user_name ?? '-'}</TableCell>
                      <TableCell><Chip size="small" color={OP_COLOR[op]} label={op === 'other' ? r.action : ACTIVITY_OP_LABELS[op]} /></TableCell>
                      <TableCell>{tableLabel(r.target_table)}</TableCell>
                      <TableCell sx={{ maxWidth: 420 }}>
                        <Typography variant="body2" color="text.secondary" noWrap>{summarizePayload(r.payload) || '-'}</Typography>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
        <TablePaginationControls page={page} rowsPerPage={pageSize} total={total} onPageChange={setPage} onRowsPerPageChange={(n) => { setPageSize(n); setPage(1); }} />
      </Card>

      <Dialog open={Boolean(detail)} onClose={() => setDetail(null)} fullWidth maxWidth="sm">
        <DialogTitle>รายละเอียด</DialogTitle>
        <DialogContent dividers>
          {detail ? (
            <Stack spacing={1.5}>
              <DetailLine label="เวลา" value={formatDateTimeDMY(detail.created_at)} />
              <DetailLine label="ผู้ใช้" value={detail.user_name ?? '-'} />
              <DetailLine label="การกระทำ" value={`${ACTIVITY_OP_LABELS[opOfAction(detail.action)]} (${detail.action})`} />
              <DetailLine label="ข้อมูล" value={`${tableLabel(detail.target_table)}${detail.target_table ? ` (${detail.target_table})` : ''}`} />
              <DetailLine label="รหัสอ้างอิง" value={detail.target_id ?? '-'} />
              <Box component="pre" sx={{ m: 0, p: 1.5, borderRadius: 1, bgcolor: 'grey.100', fontSize: 12, overflow: 'auto', maxHeight: 320, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {payloadText(detail.payload)}
              </Box>
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetail(null)}>ปิด</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}

/** Label + value row of the detail dialog. */
function DetailLine({ label, value }: { label: string; value: string }) {
  return (
    <Stack direction="row" spacing={2}>
      <Typography variant="body2" color="text.secondary" sx={{ minWidth: 96 }}>{label}</Typography>
      <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>{value}</Typography>
    </Stack>
  );
}
