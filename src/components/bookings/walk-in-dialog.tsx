'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Alert, Autocomplete, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Skeleton, Stack, TextField,
  ToggleButton, ToggleButtonGroup, Typography,
} from '@mui/material';
import type { BookingDirection } from '@/types/db';
import { useBranchScope } from '@/components/layout/branch-scope-provider';
import { QrCode } from '@/components/ui/qr-code';
import { useToast } from '@/components/ui/toast';
import { isPaymentCleared } from '@/lib/booking/payment';
import { isPlausiblePlate } from '@/lib/booking/plate';
import { LIVE_STATUSES } from '@/lib/booking/status-flow';
import { getTodayISOInBangkok } from '@/lib/utils/date-format';
import { DockSlotPicker } from './dock-slot-picker';
import { DIRECTION_META, STATUS_LABEL, hhmm, type BookingRow, type Dock, type DocumentOption, type VehicleType } from './booking-types';

/** What the dialog needs from an SO / PO — a row of the document pages fits as it is. */
export type WalkInDocument = Pick<DocumentOption, 'id' | 'doc_type' | 'doc_no' | 'branch_id' | 'partner_name' | 'payment_status' | 'branches'>;

type Draft = {
  direction: BookingDirection;
  branch_id: string;
  service_id: string;
  resource_id: string;
  booking_date: string;
  start_time: string;
  plate_number: string;
  driver_name: string;
  driver_phone: string;
  note: string;
};

type CreateResponse = {
  error?: string;
  code?: string;
  data?: { id: string; queue_number: string; do_number: string | null; status: string; resource_id: string | null; checked_in?: boolean; auto_called?: string[]; notice?: string | null };
};

type Result = NonNullable<CreateResponse['data']> & { time: string; driverUrl: string | null };

const EMPTY: Draft = { direction: 'outbound', branch_id: '', service_id: '', resource_id: '', booking_date: '', start_time: '', plate_number: '', driver_name: '', driver_phone: '', note: '' };

/** Codes `POST /api/bookings` answers when the chosen slot is gone: reload the grid. */
const SLOT_GONE = new Set(['slot_past', 'slot_unavailable']);

/**
 * "Walk-in": queue a truck that arrived without a booking. One screen — SO/PO,
 * vehicle, a free slot of today (the running one included) — then the queue
 * number and the driver's QR. A paid / credit queue comes back checked in.
 *
 * Self-contained (loads its own vehicle types, docks and documents) so the
 * queue board, the queue list and the SO / PO pages can all open it; the SO /
 * PO pages pass `document` to pin it.
 */
export function WalkInDialog({
  open, onClose, onCreated, document: pinned,
}: {
  open: boolean;
  onClose: () => void;
  /** A queue was created; the caller refreshes its own list. */
  onCreated?: () => void;
  /** Opened from an SO / PO row: the document is fixed. */
  document?: WalkInDocument | null;
}) {
  const { push } = useToast();
  const { branches, branchId: topbarBranchId } = useBranchScope();

  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [doc, setDoc] = useState<WalkInDocument | null>(null);
  const [docOptions, setDocOptions] = useState<DocumentOption[]>([]);
  const [docQuery, setDocQuery] = useState('');
  const [vehicleTypes, setVehicleTypes] = useState<VehicleType[] | null>(null);
  const [docks, setDocks] = useState<Dock[]>([]);
  const [refError, setRefError] = useState(false);
  const [refReload, setRefReload] = useState(0);
  const [liveToday, setLiveToday] = useState<BookingRow[]>([]);
  const [slotRefresh, setSlotRefresh] = useState(0);
  const [creating, setCreating] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  // Fresh form every time it opens; a pinned document also fixes the direction and the branch.
  useEffect(() => {
    if (!open) return;
    setResult(null);
    setDocQuery('');
    setDoc(pinned ?? null);
    setDraft({
      ...EMPTY,
      direction: pinned ? (pinned.doc_type === 'so' ? 'outbound' : 'inbound') : 'outbound',
      branch_id: pinned?.branch_id ?? topbarBranchId ?? '',
    });
    // Opening (or another pinned document) is the only trigger: the topbar branch is just the
    // starting value, and a caller passing a fresh object each render must not wipe the form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, pinned?.id]);

  // Vehicle types and docks feed the dropdowns.
  useEffect(() => {
    if (!open) return;
    const ctl = new AbortController();
    setRefError(false);
    Promise.all([
      fetch('/api/services?page_size=200', { cache: 'no-store', signal: ctl.signal }),
      fetch('/api/resources?page_size=100', { cache: 'no-store', signal: ctl.signal }),
    ])
      .then(async ([sRes, rRes]) => {
        if (!sRes.ok || !rRes.ok) throw new Error();
        const [sv, r] = (await Promise.all([sRes.json(), rRes.json()])) as [{ data?: VehicleType[] }, { data?: Dock[] }];
        setVehicleTypes(sv.data ?? []);
        setDocks((r.data ?? []).filter((d) => d.resource_type === 'dock'));
      })
      .catch(() => { if (!ctl.signal.aborted) setRefError(true); });
    return () => ctl.abort();
  }, [open, refReload]);

  const docType = draft.direction === 'outbound' ? 'so' : 'po';
  const dir = DIRECTION_META[draft.direction];

  // Document search, debounced. Only open / booked documents of the matching type.
  useEffect(() => {
    if (!open || pinned) return;
    const ctl = new AbortController();
    const id = setTimeout(() => {
      const dq = new URLSearchParams({ doc_type: docType, bookable: '1', page_size: '20', q: docQuery });
      if (topbarBranchId) dq.set('branch_id', topbarBranchId);
      fetch(`/api/documents?${dq}`, { cache: 'no-store', signal: ctl.signal })
        .then((r) => r.json())
        .then((j: { data?: DocumentOption[] }) => setDocOptions(j.data ?? []))
        .catch(() => undefined);
    }, 250);
    return () => { clearTimeout(id); ctl.abort(); };
  }, [open, pinned, docType, docQuery, topbarBranchId]);

  // A document that already has a live queue today is most likely the same truck: say so.
  const docId = doc?.id ?? '';
  useEffect(() => {
    setLiveToday([]);
    if (!open || !docId) return;
    const ctl = new AbortController();
    fetch(`/api/bookings?document_id=${docId}&date=${getTodayISOInBangkok()}&page_size=20`, { cache: 'no-store', signal: ctl.signal })
      .then((r) => r.json())
      .then((j: { data?: BookingRow[] }) => setLiveToday((j.data ?? []).filter((b) => (LIVE_STATUSES as readonly string[]).includes(b.status))))
      .catch(() => undefined);
    return () => ctl.abort();
  }, [open, docId]);

  const vehicleOptions = useMemo(
    () => (vehicleTypes ?? []).filter((v) => v.active !== false && (!v.direction || v.direction === draft.direction)),
    [vehicleTypes, draft.direction],
  );
  const dockOptions = useMemo(
    () => docks.filter((d) => d.active !== false && (!d.branch_id || !draft.branch_id || d.branch_id === draft.branch_id) && (!d.direction || d.direction === draft.direction)
      && (!d.service_ids || d.service_ids.length === 0 || !draft.service_id || d.service_ids.includes(draft.service_id))),
    [docks, draft.branch_id, draft.direction, draft.service_id],
  );

  const set = (key: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement>) => setDraft((p) => ({ ...p, [key]: e.target.value }));
  // The goods are at the document's branch; only a site-wide document leaves the choice open.
  const needsBranch = Boolean(doc) && !doc?.branch_id && branches.length > 1;
  const branchOk = !needsBranch || Boolean(draft.branch_id);
  const plateOk = isPlausiblePlate(draft.plate_number);
  const unpaid = Boolean(doc) && !isPaymentCleared(doc?.doc_type, doc?.payment_status);
  const canSubmit = Boolean(doc && branchOk && draft.service_id && plateOk && draft.booking_date && draft.start_time) && !creating;

  function changeDirection(next: BookingDirection | null) {
    if (!next || next === draft.direction) return;
    // Documents, vehicle types and docks are all direction-specific.
    setDoc(null);
    setDraft((p) => ({ ...p, direction: next, service_id: '', resource_id: '', booking_date: '', start_time: '' }));
  }

  function chooseDocument(next: DocumentOption | null) {
    setDoc(next);
    setDraft((p) => ({ ...p, branch_id: next?.branch_id ?? topbarBranchId ?? '', resource_id: '', booking_date: '', start_time: '' }));
  }

  async function submit() {
    if (!doc || !canSubmit) return;
    // Untouched optional inputs hold '' — drop blanks so uuid / phone validation does not trip on them.
    const payload = Object.fromEntries(Object.entries({ ...draft, document_id: doc.id }).filter(([, v]) => String(v ?? '').trim() !== ''));
    setCreating(true);
    try {
      const res = await fetch('/api/bookings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payload, walk_in: true }) });
      const j = (await res.json().catch(() => ({}))) as CreateResponse;
      if (!res.ok || !j.data) {
        push(j.error ?? 'สร้างคิว Walk-in ไม่สำเร็จ', 'error');
        if (j.code && SLOT_GONE.has(j.code)) {
          setDraft((p) => ({ ...p, booking_date: '', start_time: '' }));
          setSlotRefresh((k) => k + 1);
        }
        return;
      }
      const created = j.data;
      // The driver link exists once the queue is confirmed; a queue waiting for payment has none yet.
      let driverUrl: string | null = null;
      if (created.status !== 'pending') {
        try {
          const linkRes = await fetch(`/api/bookings/${created.id}/driver-link`, { cache: 'no-store' });
          const link = (await linkRes.json().catch(() => ({}))) as { data?: { url?: string } };
          if (linkRes.ok) driverUrl = link.data?.url ?? null;
        } catch {
          // The queue is made; the link can still be opened from the queue list.
        }
      }
      setResult({ ...created, time: draft.start_time, driverUrl });
      // A notice (waiting for payment, check-in failed) is shown on the result panel instead of a green toast.
      if (!created.notice) push(`สร้างคิว Walk-in ${created.queue_number} แล้ว`);
      if (created.auto_called && created.auto_called.length > 0) push(`ระบบเรียกคิวเข้าท่าอัตโนมัติ: ${created.auto_called.join(', ')}`);
      onCreated?.();
    } finally {
      setCreating(false);
    }
  }

  function another() {
    setResult(null);
    setDraft((p) => ({ ...EMPTY, direction: p.direction, branch_id: p.branch_id }));
    if (!pinned) setDoc(null);
    setSlotRefresh((k) => k + 1);
  }

  function handleClose() {
    if (creating) return;
    onClose();
  }

  const dockName = result?.resource_id ? docks.find((d) => d.id === result.resource_id)?.resource_name ?? null : null;
  const resultPending = result?.status === 'pending';
  /** The dock was free, so the auto-call sent this truck in straight away. */
  const resultCalled = result?.status === 'called';

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm" scroll="paper">
      <DialogTitle sx={{ fontWeight: 700 }}>Walk-in — รถมาถึงโดยไม่ได้จอง</DialogTitle>

      <DialogContent dividers>
        {result ? (
          <Stack spacing={2}>
            <Alert severity={resultPending || !result.checked_in ? 'warning' : 'success'}>
              {resultPending
                ? 'สร้างคิวแล้ว — รอชำระเงิน ยังไม่ออก DO'
                : resultCalled ? `สร้างคิว ออก DO และเช็คอินแล้ว — ท่าว่าง ระบบเรียกเข้า${dockName ?? 'ท่า'}ทันที`
                  : result.checked_in ? 'สร้างคิว ออก DO และเช็คอินแล้ว — รถรอเรียกเข้าท่า' : 'สร้างคิวและออก DO แล้ว แต่ยังไม่ได้เช็คอิน'}
            </Alert>
            {result.notice ? <Typography variant="body2" color="text.secondary">{result.notice}</Typography> : null}
            <Box sx={{ borderRadius: 2, bgcolor: 'action.hover', p: 2.5, textAlign: 'center' }}>
              <Typography variant="caption" color="text.secondary">เลขคิว</Typography>
              <Typography variant="h3" fontWeight={800} sx={{ lineHeight: 1.1 }}>{result.queue_number}</Typography>
              <Typography variant="body2" sx={{ mt: 0.5 }}>{result.do_number ?? 'ยังไม่ออก DO'}</Typography>
            </Box>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Chip size="small" label={STATUS_LABEL[result.status as keyof typeof STATUS_LABEL] ?? result.status} color={resultPending ? 'warning' : 'success'} />
              <Chip size="small" variant="outlined" label={`เวลา ${hhmm(result.time)}`} />
              {dockName ? <Chip size="small" variant="outlined" label={dockName} /> : null}
              {doc ? <Chip size="small" variant="outlined" label={doc.doc_no} /> : null}
            </Stack>
            {result.driverUrl ? (
              <Stack alignItems="center" spacing={1} sx={{ pt: 1 }}>
                <QrCode value={result.driverUrl} size={168} alt="QR ลิงก์คนขับ" />
                <Typography variant="caption" color="text.secondary" textAlign="center">ให้คนขับสแกน เพื่อดู DO และรับแจ้งเตือนเมื่อถูกเรียกเข้าท่า</Typography>
              </Stack>
            ) : null}
          </Stack>
        ) : (
          <Stack spacing={2}>
            {refError ? <Alert severity="error" action={<Button color="inherit" size="small" onClick={() => setRefReload((k) => k + 1)}>ลองใหม่</Button>}>โหลดประเภทรถ/ท่าไม่สำเร็จ</Alert> : null}

            {pinned ? (
              <Alert severity="info" icon={false} sx={{ py: 0.25 }}>
                {dir.docLabel} <b>{pinned.doc_no}</b> · {pinned.partner_name ?? '-'}{pinned.branches?.branch_name ? ` · ${pinned.branches.branch_name}` : ''}
              </Alert>
            ) : (
              <>
                <ToggleButtonGroup exclusive fullWidth size="small" value={draft.direction} onChange={(_, v: BookingDirection | null) => changeDirection(v)} aria-label="ประเภทคิว">
                  <ToggleButton value="outbound">{DIRECTION_META.outbound.label}</ToggleButton>
                  <ToggleButton value="inbound">{DIRECTION_META.inbound.label}</ToggleButton>
                </ToggleButtonGroup>
                <Autocomplete
                  size="small"
                  options={docOptions}
                  value={(doc as DocumentOption | null) ?? null}
                  filterOptions={(x) => x}
                  getOptionLabel={(o) => `${o.doc_no} · ${o.partner_name ?? '-'}`}
                  isOptionEqualToValue={(a, b) => a.id === b.id}
                  noOptionsText={`ไม่พบ ${dir.docLabel} ที่เปิดอยู่`}
                  onInputChange={(_, v, reason) => { if (reason === 'input') setDocQuery(v); }}
                  onChange={(_, v) => chooseDocument(v)}
                  renderInput={(params) => <TextField {...params} required label={`เอกสาร ${dir.docLabel}`} placeholder={`ค้นหาเลขที่ ${dir.docLabel} หรือชื่อคู่ค้า`} />}
                  renderOption={(props, o) => <li {...props} key={o.id}>{o.doc_no} · {o.partner_name ?? '-'}{o.branches?.branch_name ? ` · ${o.branches.branch_name}` : ''}</li>}
                />
              </>
            )}

            {unpaid ? <Alert severity="warning">SO นี้ยังไม่ชำระเงิน — คิวจะเป็น &quot;รอยืนยัน&quot; ยังไม่ออก DO และยังไม่เช็คอิน จนกว่าจะบันทึกการชำระเงินและอนุมัติ</Alert> : null}
            {liveToday.length > 0 ? (
              <Alert severity="info">เอกสารนี้มีคิววันนี้อยู่แล้ว: {liveToday.map((b) => `${b.queue_number} (${hhmm(b.start_time)} · ${STATUS_LABEL[b.status as keyof typeof STATUS_LABEL] ?? b.status})`).join(', ')}</Alert>
            ) : null}

            {needsBranch ? (
              <TextField select required size="small" label="สาขา / คลัง" value={draft.branch_id}
                onChange={(e) => setDraft((p) => ({ ...p, branch_id: e.target.value, resource_id: '', booking_date: '', start_time: '' }))}>
                {branches.map((b) => <MenuItem key={b.id} value={b.id}>{b.branch_name}</MenuItem>)}
              </TextField>
            ) : null}

            {vehicleTypes === null && !refError ? <Skeleton variant="rounded" height={40} /> : (
              <TextField select required size="small" label="ประเภทรถ" value={draft.service_id}
                onChange={(e) => setDraft((p) => ({ ...p, service_id: e.target.value, resource_id: '', booking_date: '', start_time: '' }))}
                helperText={vehicleTypes !== null && vehicleOptions.length === 0 ? 'ยังไม่มีประเภทรถสำหรับคิวประเภทนี้ — เพิ่มที่เมนู ประเภทรถ' : undefined}
              >
                {vehicleOptions.map((v) => <MenuItem key={v.id} value={v.id}>{v.service_name} — {v.duration_minutes ?? '-'} นาที</MenuItem>)}
              </TextField>
            )}

            <TextField required size="small" label="ทะเบียนรถ" value={draft.plate_number} onChange={set('plate_number')} placeholder="เช่น 70-1234 หรือ กข 1234"
              error={Boolean(draft.plate_number) && !plateOk} helperText={draft.plate_number && !plateOk ? 'ทะเบียนต้องมีตัวเลขอย่างน้อย 1 ตัว' : undefined} />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField fullWidth size="small" label="ชื่อคนขับ" value={draft.driver_name} onChange={set('driver_name')} />
              <TextField fullWidth size="small" label="เบอร์คนขับ" value={draft.driver_phone} onChange={set('driver_phone')} slotProps={{ htmlInput: { inputMode: 'tel' } }} />
            </Stack>

            <TextField select size="small" label="ท่า (Dock)" value={draft.resource_id} onChange={(e) => setDraft((p) => ({ ...p, resource_id: e.target.value, booking_date: '', start_time: '' }))}>
              <MenuItem value="">ให้ระบบเลือกท่าที่ว่าง</MenuItem>
              {dockOptions.map((d) => <MenuItem key={d.id} value={d.id}>{d.resource_code ? `${d.resource_code} · ` : ''}{d.resource_name}</MenuItem>)}
            </TextField>

            {doc && branchOk ? (
              <DockSlotPicker
                walkIn
                refreshKey={slotRefresh}
                direction={draft.direction}
                serviceId={draft.service_id}
                branchId={draft.branch_id || undefined}
                dockId={draft.resource_id || undefined}
                date={draft.booking_date}
                time={draft.start_time}
                onChange={(n) => setDraft((p) => ({ ...p, booking_date: n.date, start_time: n.time }))}
              />
            ) : (
              <Alert severity="info">{doc ? 'เลือกสาขาก่อน เพื่อดูเวลาที่ว่างวันนี้' : `เลือกเอกสาร ${dir.docLabel} ก่อน เพื่อดูเวลาที่ว่างวันนี้`}</Alert>
            )}

            <TextField fullWidth size="small" label="หมายเหตุ" value={draft.note} onChange={set('note')} multiline minRows={2} />
          </Stack>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        {result ? (
          <>
            <Button color="inherit" onClick={another}>Walk-in คันถัดไป</Button>
            <Button variant="contained" onClick={handleClose}>เสร็จสิ้น</Button>
          </>
        ) : (
          <>
            <Button color="inherit" onClick={handleClose} disabled={creating}>ปิด</Button>
            <Button variant="contained" disabled={!canSubmit} onClick={() => void submit()}>
              {creating ? 'กำลังสร้าง…' : unpaid ? 'สร้างคิว (รอชำระเงิน)' : 'สร้างคิว + เช็คอิน'}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}
