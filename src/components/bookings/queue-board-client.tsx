'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Box, Button, Chip, Paper, Skeleton, Stack, TextField, ToggleButton, ToggleButtonGroup, Tooltip, Typography } from '@mui/material';
import { alpha, keyframes, type Theme } from '@mui/material/styles';
import AutoModeRoundedIcon from '@mui/icons-material/AutoModeRounded';
import LocalShippingRoundedIcon from '@mui/icons-material/LocalShippingRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import { useToast } from '@/components/ui/toast';
import { useBranchScope } from '@/components/layout/branch-scope-provider';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { getTodayISOInBangkok } from '@/lib/utils/date-format';
import { effectivePlate, hasPlateMismatch } from '@/lib/booking/plate';
import { ApproveDialog, CompleteDialog, PaymentChip, isPaymentBlocked, paymentOf, type BookingSignatures } from './booking-action-dialogs';
import type { StatusPaletteKey } from '@/lib/booking/status-meta';
import { BOARD_CARD_TONE, DIRECTION_META, NEXT_STATUSES, QUEUE_COLUMNS, customerName, hhmm, type BookingRow, type NextStatusOption } from './booking-types';

const POLL_MS = 15_000;

/** Soft ring that breathes on cards currently being called, so the yard notices them. */
const calledPulse = keyframes`
  0% { box-shadow: 0 0 0 0 var(--pulse-color); }
  70% { box-shadow: 0 0 0 6px transparent; }
  100% { box-shadow: 0 0 0 0 transparent; }
`;

/** Main colour of a status tone; `default` maps to a neutral grey so every tone resolves. */
function toneMain(theme: Theme, tone: StatusPaletteKey): string {
  return tone === 'default' ? theme.palette.grey[500] : theme.palette[tone].main;
}

/** Darker shade of a tone for text sitting on its tinted background. */
function toneDark(theme: Theme, tone: StatusPaletteKey): string {
  return tone === 'default' ? theme.palette.text.secondary : theme.palette[tone].dark;
}

/** Tinted surface + coloured edge per status so each stage reads at a glance. */
function cardSx(theme: Theme, status: string) {
  const tone = BOARD_CARD_TONE[status] ?? 'default';
  const main = toneMain(theme, tone);
  const muted = status === 'completed';
  return {
    p: 1.25,
    borderRadius: 1.5,
    borderColor: alpha(main, muted ? 0.25 : 0.45),
    borderLeft: 4,
    borderLeftColor: main,
    bgcolor: muted ? theme.palette.background.paper : alpha(main, 0.07),
    opacity: muted ? 0.85 : 1,
    transition: theme.transitions.create(['box-shadow', 'transform'], { duration: theme.transitions.duration.shorter }),
    '&:hover': { boxShadow: `0 4px 14px ${alpha(main, 0.22)}`, transform: 'translateY(-1px)' },
    ...(status === 'called'
      ? { '--pulse-color': alpha(main, 0.45), animation: `${calledPulse} 2s ease-out infinite` }
      : {}),
    ...(status === 'serving' ? { borderStyle: 'solid', boxShadow: `inset 0 0 0 1px ${alpha(main, 0.25)}` } : {}),
  };
}

type SiteInfo = { auto_call_mode: string; auto_call_last_run_at: string | null; item_minutes_enabled?: boolean; minutes_per_item?: number };
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
  const { branchQuery } = useBranchScope();
  const [rows, setRows] = useState<BookingRow[]>([]);
  const [date, setDate] = useState(getTodayISOInBangkok());
  const [direction, setDirection] = useState<'all' | 'outbound' | 'inbound'>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [approveTarget, setApproveTarget] = useState<{ booking: BookingRow; opt: NextStatusOption } | null>(null);
  const [completeTarget, setCompleteTarget] = useState<{ booking: BookingRow; opt: NextStatusOption } | null>(null);
  const [site, setSite] = useState<SiteInfo | null>(null);
  const dateRef = useRef(date);
  dateRef.current = date;

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch(`/api/bookings?date=${dateRef.current}&page_size=200${branchQuery ? `&${branchQuery}` : ''}`, { cache: 'no-store' });
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
  }, [branchQuery]);

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

  async function setStatus(b: BookingRow, opt: NextStatusOption, serviceMinutes?: number, signatures?: BookingSignatures) {
    if (busyId) return;
    // Approval asks for the dock time first (and shows the payment block).
    if (opt.kind === 'confirm' && serviceMinutes === undefined) { setApproveTarget({ booking: b, opt }); return; }
    // Closing offers the sign-off pads first.
    if (opt.kind === 'done' && signatures === undefined) { setCompleteTarget({ booking: b, opt }); return; }
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
        body: JSON.stringify({ id: b.id, status: opt.status, ...(serviceMinutes !== undefined ? { service_minutes: serviceMinutes } : {}), ...(signatures && Object.keys(signatures).length ? { signatures } : {}) }),
      });
      const json = (await res.json().catch(() => ({}))) as PatchResponse;
      if (!res.ok) {
        push(json.error ?? 'เปลี่ยนสถานะไม่สำเร็จ', 'error');
        if (json.code === 'stale') await load(true);
        return;
      }
      setApproveTarget(null);
      setCompleteTarget(null);
      if (opt.kind === 'confirm' && json.data?.do_number) push(`อนุมัติคิวแล้ว · ${json.data.do_number}`);
      else if (opt.kind === 'done') push(signatures && Object.keys(signatures).length ? `ปิดงาน ${b.queue_number} พร้อมลายเซ็นแล้ว` : `ปิดงาน ${b.queue_number} แล้ว`);
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
            <Paper
              key={col.key}
              variant="outlined"
              component="section"
              sx={(theme) => {
                const main = toneMain(theme, col.tone);
                return {
                  p: 1.5,
                  minHeight: 160,
                  borderRadius: 2,
                  borderTop: 3,
                  borderTopColor: main,
                  bgcolor: col.tone === 'default' ? theme.palette.background.default : alpha(main, 0.035),
                };
              }}
            >
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.25 }}>
                <Stack direction="row" spacing={0.75} alignItems="center">
                  <Box sx={(theme) => ({ width: 8, height: 8, borderRadius: '50%', bgcolor: toneMain(theme, col.tone), flexShrink: 0 })} />
                  <Typography variant="subtitle2" fontWeight={700}>{col.label}</Typography>
                </Stack>
                <Chip
                  size="small"
                  label={items.length}
                  sx={(theme) => {
                    const main = toneMain(theme, col.tone);
                    return { fontWeight: 700, bgcolor: alpha(main, 0.14), color: toneDark(theme, col.tone) };
                  }}
                />
              </Stack>
              <Stack spacing={1}>
                {loading ? <Skeleton variant="rounded" height={84} /> : null}
                {!loading && items.length === 0 ? <Typography variant="caption" color="text.disabled">ไม่มีคิว</Typography> : null}
                {!loading && items.map((r) => {
                  const options = (NEXT_STATUSES[r.status] ?? []).filter((o) => !o.adminOnly || isAdmin);
                  const dir = DIRECTION_META[r.direction] ?? DIRECTION_META.outbound;
                  return (
                    <Paper key={r.id} variant="outlined" component="article" sx={(theme) => cardSx(theme, r.status)}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Stack direction="row" spacing={0.75} alignItems="center">
                          <Typography fontWeight={800}>{r.queue_number}</Typography>
                          <Chip
                            size="small"
                            label={dir.short}
                            sx={(theme) => ({
                              height: 18,
                              fontSize: 11,
                              fontWeight: 700,
                              bgcolor: alpha(toneMain(theme, dir.palette), 0.12),
                              color: toneDark(theme, dir.palette),
                              '& .MuiChip-label': { px: 0.75 },
                            })}
                          />
                        </Stack>
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
                        {r.services?.service_name ?? '-'} · {r.resource_name ?? 'ยังไม่ระบุท่า'}{r.branches?.branch_name ? ` · ${r.branches.branch_name}` : ''}{r.external_documents ? ` · ${r.external_documents.doc_no}` : ''}
                      </Typography>
                      <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
                        {r.status === 'late' ? <Chip size="small" color="warning" label="เลยเวลานัด" /> : null}
                        {r.status === 'pending' ? <PaymentChip status={paymentOf(r)} /> : null}
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
                              disabled={busyId !== null || (o.kind === 'confirm' && isPaymentBlocked(r))}
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

      <CompleteDialog
        booking={completeTarget?.booking ?? null}
        saving={busyId !== null}
        onClose={() => setCompleteTarget(null)}
        onSubmit={(b, signatures) => { if (completeTarget) void setStatus(b, completeTarget.opt, undefined, signatures); }}
      />
      <ApproveDialog
        booking={approveTarget?.booking ?? null}
        saving={busyId !== null}
        onClose={() => setApproveTarget(null)}
        onSubmit={(b, minutes) => { if (approveTarget) void setStatus(b, approveTarget.opt, minutes); }}
        itemMinutes={site ? { enabled: site.item_minutes_enabled ?? false, minutesPerItem: site.minutes_per_item ?? 10 } : undefined}
      />
    </Stack>
  );
}
