'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Box, Button, Chip, Paper, Skeleton, Stack, TextField, ToggleButton, ToggleButtonGroup, Tooltip, Typography } from '@mui/material';
import AutoModeRoundedIcon from '@mui/icons-material/AutoModeRounded';
import LocalShippingRoundedIcon from '@mui/icons-material/LocalShippingRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import { useToast } from '@/components/ui/toast';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { getTodayISOInBangkok } from '@/lib/utils/date-format';
import { effectivePlate, hasPlateMismatch } from '@/lib/booking/plate';
import { DIRECTION_META, NEXT_STATUSES, QUEUE_COLUMNS, customerName, hhmm, type BookingRow, type NextStatusOption } from './booking-types';

const POLL_MS = 15_000;

type SiteInfo = { auto_call_mode: string; auto_call_last_run_at: string | null };
type PatchResponse = { error?: string; code?: string; data?: { auto_called?: string[]; do_number?: string | null } };

function minutesSince(iso: string | null): number | null {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  return Number.isFinite(ms) ? Math.max(0, Math.round(ms / 60_000)) : null;
}

/**
 * Yard board: one column per stage, refreshed every 15 s so an auto-call made
 * by the system (or another tablet) shows up without a reload.
 */
export function QueueBoardClient({ isAdmin }: { isAdmin: boolean }) {
  const { push } = useToast();
  const confirm = useConfirm();
  const [rows, setRows] = useState<BookingRow[]>([]);
  const [date, setDate] = useState(getTodayISOInBangkok());
  const [direction, setDirection] = useState<'all' | 'outbound' | 'inbound'>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [site, setSite] = useState<SiteInfo | null>(null);
  const dateRef = useRef(date);
  dateRef.current = date;

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch(`/api/bookings?date=${dateRef.current}&page_size=200`, { cache: 'no-store' });
      const json = (await res.json()) as { data?: BookingRow[]; error?: string };
      if (!res.ok) throw new Error(json.error ?? 'โหลดคิวไม่สำเร็จ');
      setRows(json.data ?? []);
      setError(null);
    } catch (e) {
      // A failed background poll keeps the last good board on screen.
      if (!silent) setError(e instanceof Error ? e.message : 'โหลดคิวไม่สำเร็จ');
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  const loadSite = useCallback(async () => {
    try {
      const res = await fetch('/api/site-settings', { cache: 'no-store' });
      const json = (await res.json()) as { data?: SiteInfo };
      if (res.ok && json.data) setSite(json.data);
    } catch {
      // indicator only
    }
  }, []);

  useEffect(() => { void load(); }, [load, date]);
  useEffect(() => {
    void loadSite();
    const id = setInterval(() => { void load(true); void loadSite(); }, POLL_MS);
    return () => clearInterval(id);
  }, [load, loadSite]);

  async function setStatus(b: BookingRow, opt: NextStatusOption) {
    if (busyId) return;
    if (opt.kind === 'no_show') {
      const ok = await confirm({
        tone: 'warning',
        title: 'บันทึกว่ารถไม่มา?',
        description: 'คิวจะถูกปิดและช่วงเวลา/ท่าจะว่างให้คิวอื่น',
        context: { primary: `${b.queue_number} · ${effectivePlate(b) || '-'}`, secondary: customerName(b) },
        confirmLabel: 'บันทึกไม่มา',
      });
      if (!ok) return;
    }
    setBusyId(b.id);
    try {
      const res = await fetch('/api/bookings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: b.id, status: opt.status }),
      });
      const json = (await res.json().catch(() => ({}))) as PatchResponse;
      if (!res.ok) {
        push(json.error ?? 'เปลี่ยนสถานะไม่สำเร็จ', 'error');
        if (json.code === 'stale') await load(true);
        return;
      }
      if (opt.kind === 'confirm' && json.data?.do_number) push(`ยืนยันคิวแล้ว · ${json.data.do_number}`);
      else if (opt.kind === 'call' || opt.kind === 'recall') push(`เรียก ${b.queue_number} เข้า${b.resource_name ?? 'ท่า'}แล้ว`);
      const auto = json.data?.auto_called ?? [];
      if (auto.length > 0) push(`ระบบเรียกคิวถัดไปอัตโนมัติ: ${auto.join(', ')}`);
      await load(true);
    } finally {
      setBusyId(null);
    }
  }

  const visible = useMemo(() => (direction === 'all' ? rows : rows.filter((r) => r.direction === direction)), [rows, direction]);
  const lastRun = minutesSince(site?.auto_call_last_run_at ?? null);
  const autoOn = site ? site.auto_call_mode !== 'off' : false;

  return (
    <Stack spacing={2}>
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }} justifyContent="space-between">
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
            <TextField type="date" size="small" label="วันที่" value={date} onChange={(e) => setDate(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} sx={{ minWidth: 180 }} />
            <ToggleButtonGroup size="small" exclusive value={direction} onChange={(_, v) => v && setDirection(v)} aria-label="ประเภทคิว">
              <ToggleButton value="all">ทั้งหมด</ToggleButton>
              <ToggleButton value="outbound">{DIRECTION_META.outbound.short}สินค้า</ToggleButton>
              <ToggleButton value="inbound">{DIRECTION_META.inbound.short}สินค้า</ToggleButton>
            </ToggleButtonGroup>
          </Stack>
          <Stack direction="row" spacing={1} alignItems="center">
            {site ? (
              <Tooltip title={autoOn ? 'ระบบเรียกคิวที่มาถึงแล้วเข้าท่าเองเมื่อท่าว่าง' : 'ปิดอยู่ — เรียกคิวด้วยตนเอง (ตั้งค่าได้ที่ ตั้งค่าระบบ)'}>
                <Chip
                  size="small"
                  icon={<AutoModeRoundedIcon />}
                  color={autoOn ? 'success' : 'default'}
                  variant={autoOn ? 'filled' : 'outlined'}
                  label={autoOn ? `เรียกอัตโนมัติ: เปิด${lastRun !== null ? ` · ตรวจล่าสุด ${lastRun} นาที` : ''}` : 'เรียกอัตโนมัติ: ปิด'}
                />
              </Tooltip>
            ) : null}
            <Button size="small" startIcon={<RefreshRoundedIcon />} onClick={() => void load()} disabled={loading}>รีเฟรช</Button>
          </Stack>
        </Stack>
      </Paper>

      {error ? <Alert severity="error" action={<Button color="inherit" size="small" onClick={() => void load()}>ลองใหม่</Button>}>{error}</Alert> : null}

      <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(6, minmax(0, 1fr))' } }}>
        {QUEUE_COLUMNS.map((col) => {
          const items = visible.filter((r) => (col.statuses as string[]).includes(r.status));
          return (
            <Paper key={col.key} variant="outlined" component="section" sx={{ p: 1.5, minHeight: 160, bgcolor: 'background.default' }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                <Typography variant="subtitle2" fontWeight={700}>{col.label}</Typography>
                <Chip size="small" label={items.length} />
              </Stack>
              <Stack spacing={1}>
                {loading ? <Skeleton variant="rounded" height={84} /> : null}
                {!loading && items.length === 0 ? <Typography variant="caption" color="text.disabled">ไม่มีคิว</Typography> : null}
                {!loading && items.map((r) => {
                  const options = (NEXT_STATUSES[r.status] ?? []).filter((o) => !o.adminOnly || isAdmin);
                  const dir = DIRECTION_META[r.direction] ?? DIRECTION_META.outbound;
                  return (
                    <Paper key={r.id} variant="outlined" component="article" sx={{ p: 1.25, borderLeft: 4, borderLeftColor: `${dir.palette}.main` }}>
                      <Stack direction="row" justifyContent="space-between" alignItems="baseline">
                        <Typography fontWeight={800}>{r.queue_number}</Typography>
                        <Typography variant="caption" color="text.secondary">{hhmm(r.start_time)}{r.end_time ? `–${hhmm(r.end_time)}` : ''}</Typography>
                      </Stack>
                      <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 0.25 }}>
                        <LocalShippingRoundedIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                        <Typography variant="body2" fontWeight={700}>{effectivePlate(r) || '-'}</Typography>
                        {hasPlateMismatch(r) ? (
                          <Tooltip title={`ทะเบียนที่จอง: ${r.plate_number}`}><WarningAmberRoundedIcon sx={{ fontSize: 16, color: 'warning.main' }} /></Tooltip>
                        ) : null}
                      </Stack>
                      <Typography variant="caption" color="text.secondary" display="block" noWrap>{customerName(r)}</Typography>
                      <Typography variant="caption" color="text.secondary" display="block" noWrap>
                        {r.services?.service_name ?? '-'} · {r.resource_name ?? 'ยังไม่ระบุท่า'}{r.external_documents ? ` · ${r.external_documents.doc_no}` : ''}
                      </Typography>
                      <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
                        {r.status === 'late' ? <Chip size="small" color="warning" label="เลยเวลานัด" /> : null}
                        {r.status === 'called' && r.auto_called ? <Chip size="small" variant="outlined" color="success" label="เรียกอัตโนมัติ" /> : null}
                        {r.status === 'called' && Number(r.call_count ?? 0) > 1 ? <Chip size="small" variant="outlined" color="warning" label={`เรียก ${r.call_count} ครั้ง`} /> : null}
                      </Stack>
                      {options.length > 0 ? (
                        <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
                          {options.map((o) => (
                            <Button
                              key={`${o.kind}-${o.status}`}
                              size="small"
                              variant={o.primary ? 'contained' : 'text'}
                              color={o.kind === 'no_show' ? 'error' : o.kind === 'uncall' ? 'inherit' : 'primary'}
                              disabled={busyId !== null}
                              onClick={() => void setStatus(r, o)}
                              sx={{ minHeight: 36 }}
                            >
                              {busyId === r.id && o.primary ? 'กำลังบันทึก…' : o.label}
                            </Button>
                          ))}
                        </Stack>
                      ) : null}
                    </Paper>
                  );
                })}
              </Stack>
            </Paper>
          );
        })}
      </Box>
    </Stack>
  );
}
