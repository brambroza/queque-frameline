'use client';

import {
  Box, Button, Card, Chip, Paper, Skeleton, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tooltip, Typography,
} from '@mui/material';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import { StatusChip } from '@/components/shared/status-chip';
import { EmptyState } from '@/components/ui/empty-state';
import { TablePaginationControls } from '@/components/ui/table-pagination-controls';
import { effectivePlate, hasPlateMismatch } from '@/lib/booking/plate';
import { formatDateDMY } from '@/lib/utils/date-format';
import { DIRECTION_META, NEXT_STATUSES, customerName, hhmm, type BookingRow } from './booking-types';

function DirectionChip({ b }: { b: BookingRow }) {
  const d = DIRECTION_META[b.direction] ?? DIRECTION_META.outbound;
  return <Chip size="small" variant="outlined" color={d.palette === 'default' ? undefined : d.palette} label={d.short} />;
}

function Plate({ b }: { b: BookingRow }) {
  return (
    <Stack direction="row" spacing={0.5} alignItems="center">
      <Typography variant="body2" fontWeight={700}>{effectivePlate(b) || '-'}</Typography>
      {hasPlateMismatch(b) ? (
        <Tooltip title={`ทะเบียนที่จองไว้: ${b.plate_number}`}><WarningAmberRoundedIcon sx={{ fontSize: 16, color: 'warning.main' }} /></Tooltip>
      ) : null}
    </Stack>
  );
}

/**
 * Queue list: table from `md` up, cards on phones. The primary next step is
 * one tap away; everything else lives in the detail drawer (`onEdit`).
 */
export function BookingsTable({
  rows, total, page, pageSize, loading, busy, isAdmin, onPageChange, onPageSizeChange, onStatus, onEdit, onCreate,
}: {
  rows: BookingRow[];
  total: number;
  page: number;
  pageSize: number;
  loading: boolean;
  busy: boolean;
  isAdmin: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  onStatus: (b: BookingRow, status: string) => void;
  onEdit: (b: BookingRow) => void;
  onCreate: () => void;
}) {
  const primaryOf = (b: BookingRow) => (NEXT_STATUSES[b.status] ?? []).find((o) => o.primary && (!o.adminOnly || isAdmin));

  if (loading && rows.length === 0) {
    return <Card sx={{ p: 2 }}><Stack spacing={1}>{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} variant="rounded" height={44} />)}</Stack></Card>;
  }
  if (!loading && rows.length === 0) {
    return (
      <Card>
        <EmptyState icon="🚚" title="ไม่พบคิวตามเงื่อนไขนี้" description="ลองเปลี่ยนช่วงวันที่หรือสถานะ หรือสร้างคิวใหม่ให้ลูกค้า / Supplier" actionLabel="สร้างคิว" onAction={onCreate} />
      </Card>
    );
  }

  return (
    <Card>
      {/* Phones */}
      <Stack spacing={1} sx={{ display: { xs: 'flex', md: 'none' }, p: 1.5, opacity: loading ? 0.6 : 1 }}>
        {rows.map((b) => {
          const primary = primaryOf(b);
          return (
            <Paper key={b.id} variant="outlined" sx={{ p: 1.5 }} onClick={() => onEdit(b)}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography fontWeight={800}>{b.queue_number}</Typography>
                  <DirectionChip b={b} />
                </Stack>
                <StatusChip status={b.status} />
              </Stack>
              <Stack direction="row" justifyContent="space-between" sx={{ mt: 0.75 }}>
                <Plate b={b} />
                <Typography variant="body2">{formatDateDMY(b.booking_date)} {hhmm(b.start_time)}</Typography>
              </Stack>
              <Typography variant="caption" color="text.secondary" display="block" noWrap>
                {customerName(b)} · {b.services?.service_name ?? '-'} · {b.resource_name ?? 'ยังไม่ระบุท่า'}
              </Typography>
              {primary ? (
                <Button fullWidth size="small" variant="contained" disabled={busy} sx={{ mt: 1, minHeight: 40 }}
                  onClick={(e) => { e.stopPropagation(); onStatus(b, primary.status); }}>
                  {primary.label}
                </Button>
              ) : null}
            </Paper>
          );
        })}
      </Stack>

      {/* Desktop */}
      <TableContainer sx={{ display: { xs: 'none', md: 'block' } }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>คิว</TableCell>
              <TableCell>วันเวลา</TableCell>
              <TableCell>ทะเบียน / ประเภทรถ</TableCell>
              <TableCell>คู่ค้า / เอกสาร</TableCell>
              <TableCell>ท่า</TableCell>
              <TableCell>DO</TableCell>
              <TableCell>สถานะ</TableCell>
              <TableCell align="right">จัดการ</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((b) => {
              const primary = primaryOf(b);
              return (
                <TableRow key={b.id} hover sx={{ opacity: loading ? 0.6 : 1, cursor: 'pointer' }} onClick={() => onEdit(b)}>
                  <TableCell>
                    <Stack direction="row" spacing={0.75} alignItems="center">
                      <Typography variant="body2" fontWeight={800}>{b.queue_number}</Typography>
                      <DirectionChip b={b} />
                    </Stack>
                  </TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>
                    <Typography component="span" variant="body2" fontWeight={600}>{formatDateDMY(b.booking_date)}</Typography>{' '}
                    <Typography component="span" variant="body2" color="text.secondary">{hhmm(b.start_time)}{b.end_time ? `–${hhmm(b.end_time)}` : ''}</Typography>
                  </TableCell>
                  <TableCell>
                    <Plate b={b} />
                    <Typography variant="caption" color="text.secondary">{b.services?.service_name ?? '-'}</Typography>
                  </TableCell>
                  <TableCell sx={{ maxWidth: 220 }}>
                    <Typography variant="body2" noWrap>{customerName(b)}</Typography>
                    <Typography variant="caption" color="text.secondary">{b.external_documents?.doc_no ?? 'ไม่มีเอกสาร'}</Typography>
                  </TableCell>
                  <TableCell>{b.resource_name ?? <Typography variant="caption" color="text.disabled">ยังไม่ระบุ</Typography>}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{b.do_number ?? <Typography variant="caption" color="text.disabled">—</Typography>}</TableCell>
                  <TableCell>
                    <Stack spacing={0.5} alignItems="flex-start">
                      <StatusChip status={b.status} />
                      {b.status === 'called' && b.auto_called ? <Chip size="small" variant="outlined" color="success" label="อัตโนมัติ" /> : null}
                    </Stack>
                  </TableCell>
                  <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                    {primary ? (
                      <Button size="small" variant="contained" disabled={busy} onClick={(e) => { e.stopPropagation(); onStatus(b, primary.status); }}>{primary.label}</Button>
                    ) : null}
                    <Button size="small" color="inherit" sx={{ ml: 0.5 }} onClick={(e) => { e.stopPropagation(); onEdit(b); }}>รายละเอียด</Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
      <Box>
        <TablePaginationControls page={page} rowsPerPage={pageSize} total={total} onPageChange={onPageChange} onRowsPerPageChange={onPageSizeChange} />
      </Box>
    </Card>
  );
}
