'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Divider, Drawer, IconButton,
  Skeleton, Stack, Tab, Tabs, TextField, Tooltip, Typography,
} from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import PrintRoundedIcon from '@mui/icons-material/PrintRounded';
import SwapHorizRoundedIcon from '@mui/icons-material/SwapHorizRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import { StatusChip } from '@/components/shared/status-chip';
import { QrCode } from '@/components/ui/qr-code';
import { useToast } from '@/components/ui/toast';
import { DoDocument, type DoDocumentData } from '@/components/delivery-order/do-document';
import { useDoPrint } from '@/components/delivery-order/do-print';
import { effectivePlate, hasPlateMismatch, isPlausiblePlate } from '@/lib/booking/plate';
import { formatDateDMY, formatDateTimeDMY } from '@/lib/utils/date-format';
import { PaymentChip, isPaymentBlocked, paymentOf, type PaymentTarget } from './booking-action-dialogs';
import { PAYMENT_BLOCK_MESSAGE } from '@/lib/booking/payment';
import { CANCELLABLE, DIRECTION_META, MOVABLE, NEXT_STATUSES, customerName, customerPhone, hhmm, type BookingRow } from './booking-types';

type LogRow = { id: string; action: string; description: string | null; actor_kind: string | null; actor_name: string | null; created_at: string };
type DocItems = Array<{ sku?: string | null; name: string; qty: number; uom?: string | null }>;

const ACTOR_LABEL: Record<string, string> = { admin: 'ผู้ดูแล', staff: 'พนักงาน', customer: 'ลูกค้า', driver: 'คนขับ', system: 'ระบบ' };

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <Stack direction="row" spacing={1.5} sx={{ py: 0.4 }}>
      <Typography variant="body2" color="text.secondary" sx={{ width: 112, flexShrink: 0 }}>{k}</Typography>
      <Typography variant="body2" component="div" sx={{ minWidth: 0, wordBreak: 'break-word' }}>{v || '-'}</Typography>
    </Stack>
  );
}

/**
 * Queue detail drawer: facts + actions, audit timeline, DO (print) and the
 * driver link. Status changes go through `onStatus`; plate edits and the
 * driver link are handled here because they only concern this drawer.
 */
export function BookingEditDrawer({
  booking, isAdmin, saving, siteName, onClose, onStatus, onMove, onChanged, onDuration, onPayment,
}: {
  booking: BookingRow | null;
  isAdmin: boolean;
  saving: boolean;
  siteName: string;
  onClose: () => void;
  onStatus: (b: BookingRow, status: string, cancelReason?: string) => void;
  /** Open the "ปรับเวลาที่ท่า" dialog. */
  onDuration: (b: BookingRow) => void;
  /** Open the payment dialog for the queue's SO. */
  onPayment: (target: PaymentTarget) => void;
  onMove: (b: BookingRow) => void;
  /** Something other than status changed (plate) — parent should reload. */
  onChanged: () => void;
}) {
  const { push } = useToast();
  const [tab, setTab] = useState(0);
  const [logs, setLogs] = useState<LogRow[] | null>(null);
  const [logsError, setLogsError] = useState(false);
  const [items, setItems] = useState<DocItems>([]);
  const [link, setLink] = useState<{ url: string; liff_url?: string | null; expires_at: string } | null>(null);
  const [sendingLine, setSendingLine] = useState(false);
  const [linkLoading, setLinkLoading] = useState(false);
  const [plateOpen, setPlateOpen] = useState(false);
  const [plateDraft, setPlateDraft] = useState('');
  const [plateReason, setPlateReason] = useState('');
  const [plateSaving, setPlateSaving] = useState(false);

  const b = booking;
  const id = b?.id ?? null;

  useEffect(() => { setTab(0); setLogs(null); setLink(null); setItems([]); setPlateOpen(false); }, [id]);

  const loadLogs = useCallback(async () => {
    if (!id) return;
    setLogsError(false);
    try {
      const res = await fetch(`/api/bookings/${id}/logs`, { cache: 'no-store' });
      const j = (await res.json()) as { data?: LogRow[] };
      if (!res.ok) throw new Error();
      setLogs(j.data ?? []);
    } catch {
      setLogsError(true);
    }
  }, [id]);

  const loadLink = useCallback(async (regenerate: boolean) => {
    if (!id) return;
    setLinkLoading(true);
    try {
      const res = await fetch(`/api/bookings/${id}/driver-link`, { method: regenerate ? 'POST' : 'GET', cache: 'no-store' });
      const j = (await res.json()) as { data?: { url: string; liff_url?: string | null; expires_at: string }; error?: string };
      if (!res.ok || !j.data) { push(j.error ?? 'ออกลิงก์คนขับไม่สำเร็จ', 'error'); return; }
      setLink(j.data);
      if (regenerate) push('สร้างลิงก์ใหม่แล้ว ลิงก์เดิมใช้ไม่ได้แล้ว');
    } finally {
      setLinkLoading(false);
    }
  }, [id, push]);

  useEffect(() => { if (tab === 1 && logs === null) void loadLogs(); }, [tab, logs, loadLogs]);
  useEffect(() => { if ((tab === 2 || tab === 3) && !link && b?.do_number) void loadLink(false); }, [tab, link, b?.do_number, loadLink]);
  useEffect(() => {
    if (tab !== 2 || !b?.document_id) return;
    let alive = true;
    fetch(`/api/documents/${b.document_id}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((j: { data?: { items?: DocItems } }) => { if (alive) setItems(j.data?.items ?? []); })
      .catch(() => undefined);
    return () => { alive = false; };
  }, [tab, b?.document_id]);

  const doData: DoDocumentData | null = b
    ? {
        siteName,
        doNumber: b.do_number ?? null,
        queueNumber: b.queue_number,
        direction: b.direction,
        docNo: b.external_documents?.doc_no ?? null,
        partnerName: customerName(b),
        bookingDate: b.booking_date,
        startTime: b.start_time,
        endTime: b.end_time ?? null,
        dockName: b.resource_name ?? null,
        vehicleType: b.services?.service_name ?? null,
        plate: effectivePlate(b),
        driverName: b.driver_name ?? null,
        driverPhone: b.driver_phone ?? null,
        receiverName: b.receiver_name ?? null,
        receiverPhone: b.receiver_phone ?? null,
        note: b.note ?? null,
        issuedAt: b.do_issued_at ?? null,
        items,
      }
    : null;
  const qrNode = link ? <QrCode value={link.url} size={110} alt="ลิงก์คนขับ" /> : undefined;
  const { print, sheet } = useDoPrint(doData, qrNode);

  async function savePlate() {
    if (!b || plateSaving) return;
    if (!isPlausiblePlate(plateDraft)) { push('ทะเบียนรถไม่ถูกต้อง', 'error'); return; }
    setPlateSaving(true);
    try {
      const res = await fetch(`/api/bookings/${b.id}/plate`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plate_number_actual: plateDraft, reason: plateReason }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) { push(j.error ?? 'บันทึกทะเบียนไม่สำเร็จ', 'error'); return; }
      push('บันทึกทะเบียนรถแล้ว');
      setPlateOpen(false);
      setLogs(null);
      onChanged();
    } finally {
      setPlateSaving(false);
    }
  }

  /** The parent opens the cancel dialog, where the reason is mandatory. */
  function cancelBooking() {
    if (b) onStatus(b, 'cancelled');
  }

  async function copyLink() {
    if (!link) return;
    try { await navigator.clipboard.writeText(link.liff_url ?? link.url); push('คัดลอกลิงก์แล้ว'); } catch { push('คัดลอกไม่สำเร็จ', 'error'); }
  }

  async function sendLine() {
    if (!b || sendingLine) return;
    setSendingLine(true);
    try {
      const res = await fetch(`/api/bookings/${b.id}/driver-link/send-line`, { method: 'POST' });
      const j = (await res.json().catch(() => ({}))) as { data?: { target?: 'driver' | 'partner' }; error?: string };
      if (!res.ok) { push(j.error ?? 'ส่ง LINE ไม่สำเร็จ', 'error'); return; }
      push(j.data?.target === 'driver' ? 'ส่งใบงานให้คนขับทาง LINE แล้ว' : 'ส่งให้ลูกค้าทาง LINE แล้ว (ให้ลูกค้าส่งต่อคนขับ)');
      setLogs(null);
    } finally {
      setSendingLine(false);
    }
  }

  const next = b ? NEXT_STATUSES[b.status] ?? [] : [];
  const payment = b ? paymentOf(b) : null;
  const paymentBlocked = b ? isPaymentBlocked(b) : false;
  const paymentTarget: PaymentTarget | null = b?.document_id && b.external_documents
    ? { id: b.document_id, doc_no: b.external_documents.doc_no, partner_name: customerName(b), payment_status: b.external_documents.payment_status }
    : null;
  const dir = b ? DIRECTION_META[b.direction] ?? DIRECTION_META.outbound : DIRECTION_META.outbound;
  const terminal = b ? ['completed', 'cancelled', 'no_show'].includes(b.status) : false;

  return (
    <Drawer anchor="right" open={Boolean(b)} onClose={saving ? undefined : onClose} PaperProps={{ sx: { width: { xs: '100%', sm: 520 } } }}>
      {b ? (
        <>
          <Stack direction="row" alignItems="flex-start" justifyContent="space-between" sx={{ px: 3, py: 2 }}>
            <Box sx={{ minWidth: 0 }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography variant="h6" fontWeight={800}>{b.queue_number}</Typography>
                <StatusChip status={b.status} />
                <Chip size="small" variant="outlined" color={dir.palette === 'default' ? undefined : dir.palette} label={dir.short + 'สินค้า'} />
              </Stack>
              <Typography variant="body2" color="text.secondary" noWrap>{customerName(b)}{customerPhone(b) ? ` · ${customerPhone(b)}` : ''}</Typography>
            </Box>
            <IconButton onClick={onClose} aria-label="ปิด" disabled={saving}><CloseRoundedIcon /></IconButton>
          </Stack>
          <Tabs value={tab} onChange={(_, v: number) => setTab(v)} variant="fullWidth" sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tab label="ข้อมูล" />
            <Tab label="ไทม์ไลน์" />
            <Tab label="DO" />
            <Tab label="ลิงก์คนขับ" />
          </Tabs>

          <Box sx={{ flex: 1, overflowY: 'auto', px: 3, py: 2.5 }}>
            {tab === 0 ? (
              <Stack spacing={2}>
                {paymentBlocked && b.status === 'pending' ? (
                  <Alert severity="error" action={paymentTarget ? <Button color="inherit" size="small" onClick={() => onPayment(paymentTarget)}>บันทึกการชำระเงิน</Button> : undefined}>
                    {PAYMENT_BLOCK_MESSAGE}
                  </Alert>
                ) : null}
                {b.status === 'late' ? <Alert severity="warning">เลยเวลานัดแล้ว รถยังไม่มาถึง — ยังเช็คอินได้เมื่อรถมา</Alert> : null}
                <Box sx={{ borderRadius: 2, bgcolor: 'action.hover', p: 2 }}>
                  <Row k="วันเวลา" v={<><b>{formatDateDMY(b.booking_date)}</b> {hhmm(b.start_time)}{b.end_time ? ` – ${hhmm(b.end_time)}` : ''}</>} />
                  <Row k="ท่า (Dock)" v={b.resource_name} />
                  <Row k="ประเภทรถ" v={b.services?.service_name} />
                  <Row k="เวลาที่ท่า" v={b.service_minutes ? `${b.service_minutes} นาที${b.services?.duration_minutes && b.services.duration_minutes !== b.service_minutes ? ` (ค่าตั้งต้น ${b.services.duration_minutes})` : ''}` : null} />
                  <Row k={`เอกสาร ${dir.docLabel}`} v={b.external_documents?.doc_no} />
                  {payment ? (
                    <Row
                      k="การชำระเงิน"
                      v={
                        <Stack direction="row" spacing={0.75} alignItems="center">
                          <PaymentChip status={payment} />
                          {paymentTarget && !terminal ? <Button size="small" onClick={() => onPayment(paymentTarget)}>แก้ไข</Button> : null}
                        </Stack>
                      }
                    />
                  ) : null}
                  <Row k="เลข DO" v={b.do_number ? <b>{b.do_number}</b> : 'ยังไม่ออก'} />
                  {MOVABLE.has(b.status) && isAdmin ? (
                    <Button size="small" variant="outlined" color="secondary" startIcon={<SwapHorizRoundedIcon />} sx={{ mt: 1 }} disabled={saving} onClick={() => onMove(b)}>
                      เลื่อนวัน / เวลา / ท่า
                    </Button>
                  ) : null}
                  {!terminal ? (
                    <Button size="small" variant="outlined" color="secondary" startIcon={<EditRoundedIcon />} sx={{ mt: 1, ml: MOVABLE.has(b.status) && isAdmin ? 1 : 0 }} disabled={saving} onClick={() => onDuration(b)}>
                      ปรับเวลาที่ท่า
                    </Button>
                  ) : null}
                </Box>

                <Box>
                  <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <Typography variant="subtitle2" fontWeight={700}>รถและคนขับ</Typography>
                    {!terminal ? (
                      <Button size="small" startIcon={<EditRoundedIcon />} onClick={() => { setPlateDraft(effectivePlate(b)); setPlateReason(''); setPlateOpen(true); }}>
                        แก้ทะเบียน
                      </Button>
                    ) : null}
                  </Stack>
                  <Row
                    k="ทะเบียนรถ"
                    v={
                      <Stack direction="row" spacing={0.75} alignItems="center">
                        <b>{effectivePlate(b) || '-'}</b>
                        {hasPlateMismatch(b) ? (
                          <Tooltip title="ทะเบียนหน้างานไม่ตรงกับที่จอง">
                            <Chip size="small" color="warning" icon={<WarningAmberRoundedIcon />} label={`จองไว้: ${b.plate_number}`} />
                          </Tooltip>
                        ) : null}
                      </Stack>
                    }
                  />
                  <Row k="คนขับ" v={[b.driver_name, b.driver_phone].filter(Boolean).join(' · ')} />
                  <Row k={b.direction === 'outbound' ? 'ผู้รับสินค้า' : 'ผู้ติดต่อ'} v={[b.receiver_name, b.receiver_phone].filter(Boolean).join(' · ')} />
                  <Row k="หมายเหตุ" v={b.note} />
                  {b.cancel_reason ? <Row k="เหตุผลยกเลิก" v={b.cancel_reason} /> : null}
                </Box>

                {next.length > 0 ? (
                  <Box>
                    <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>ขั้นตอนถัดไป</Typography>
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                      {next.map((o) => (
                        <Button
                          key={`${o.kind}-${o.status}`}
                          variant={o.primary ? 'contained' : 'outlined'}
                          color={o.kind === 'no_show' ? 'error' : o.kind === 'uncall' ? 'inherit' : 'primary'}
                          disabled={saving || (o.kind === 'confirm' && paymentBlocked)}
                          onClick={() => onStatus(b, o.status)}
                          sx={{ minHeight: 40 }}
                        >
                          {o.label}
                        </Button>
                      ))}
                    </Stack>
                  </Box>
                ) : null}
              </Stack>
            ) : null}

            {tab === 1 ? (
              <Stack spacing={1.5}>
                {logsError ? <Alert severity="error" action={<Button color="inherit" size="small" onClick={() => void loadLogs()}>ลองใหม่</Button>}>โหลดไทม์ไลน์ไม่สำเร็จ</Alert> : null}
                {!logsError && logs === null ? <><Skeleton height={48} /><Skeleton height={48} /><Skeleton height={48} /></> : null}
                {logs && logs.length === 0 ? <Typography variant="body2" color="text.secondary">ยังไม่มีประวัติ</Typography> : null}
                {logs?.map((l) => (
                  <Box key={l.id} sx={{ borderLeft: 2, borderColor: 'divider', pl: 1.5 }}>
                    <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>{l.description ?? l.action}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {formatDateTimeDMY(l.created_at)} · {ACTOR_LABEL[l.actor_kind ?? ''] ?? '-'}{l.actor_name ? ` (${l.actor_name})` : ''}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            ) : null}

            {tab === 2 ? (
              <Stack spacing={2}>
                {!b.do_number ? (
                  <Alert severity="info">DO จะออกเมื่อผู้ดูแลระบบยืนยันคิว</Alert>
                ) : (
                  <>
                    <Button variant="contained" startIcon={<PrintRoundedIcon />} onClick={print} sx={{ alignSelf: 'flex-start' }}>พิมพ์ / บันทึกเป็น PDF</Button>
                    <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 2, overflow: 'auto' }}>
                      <Box sx={{ transform: 'scale(0.6)', transformOrigin: 'top left', width: '166.7%' }}>
                        {doData ? <DoDocument data={doData} qr={qrNode} /> : null}
                      </Box>
                    </Box>
                  </>
                )}
              </Stack>
            ) : null}

            {tab === 3 ? (
              <Stack spacing={2} alignItems="flex-start">
                {!b.do_number ? (
                  <Alert severity="info" sx={{ width: '100%' }}>ออกลิงก์คนขับได้หลังยืนยันคิวแล้ว</Alert>
                ) : linkLoading && !link ? (
                  <Skeleton variant="rounded" width={200} height={200} />
                ) : link ? (
                  <>
                    <Typography variant="body2" color="text.secondary">ส่งลิงก์หรือให้คนขับสแกน QR เพื่อดู DO และท่าที่ต้องเข้า (ไม่ต้องล็อกอิน)</Typography>
                    <Box sx={{ p: 1.5, bgcolor: '#fff', borderRadius: 2, border: 1, borderColor: 'divider' }}><QrCode value={link.liff_url ?? link.url} size={200} alt="ลิงก์คนขับ" /></Box>
                    {link.liff_url ? <TextField fullWidth size="small" label="ลิงก์สำหรับส่งใน LINE" value={link.liff_url} slotProps={{ input: { readOnly: true } }} /> : null}
                    <TextField fullWidth size="small" label={link.liff_url ? 'ลิงก์เว็บ' : 'ลิงก์คนขับ'} value={link.url} slotProps={{ input: { readOnly: true } }} />
                    <Typography variant="caption" color="text.secondary">ใช้ได้ถึง {formatDateTimeDMY(link.expires_at)}</Typography>
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                      <Button variant="contained" startIcon={<ContentCopyRoundedIcon />} onClick={() => void copyLink()}>คัดลอกลิงก์</Button>
                      {link.liff_url ? <Button variant="outlined" color="success" disabled={sendingLine} onClick={() => void sendLine()}>{sendingLine ? 'กำลังส่ง…' : 'ส่งทาง LINE'}</Button> : null}
                      <Button color="inherit" disabled={linkLoading} onClick={() => void loadLink(true)}>สร้างลิงก์ใหม่</Button>
                    </Stack>
                  </>
                ) : (
                  <Button variant="outlined" onClick={() => void loadLink(false)}>ออกลิงก์คนขับ</Button>
                )}
              </Stack>
            ) : null}
          </Box>

          {CANCELLABLE.has(b.status) ? (
            <>
              <Divider />
              <Stack direction="row" justifyContent="flex-end" sx={{ px: 3, py: 1.5 }}>
                <Button color="error" disabled={saving} onClick={() => void cancelBooking()}>ยกเลิกคิว</Button>
              </Stack>
            </>
          ) : null}

          <Dialog open={plateOpen} onClose={plateSaving ? undefined : () => setPlateOpen(false)} fullWidth maxWidth="xs">
            <DialogTitle>แก้ทะเบียนรถที่มาจริง</DialogTitle>
            <DialogContent>
              <Stack spacing={2} sx={{ pt: 1 }}>
                <Typography variant="body2" color="text.secondary">ทะเบียนที่จองไว้: <b>{b.plate_number || '-'}</b> — ระบบเก็บทั้งสองค่าและบันทึกผู้แก้ไข</Typography>
                <TextField autoFocus size="small" label="ทะเบียนรถที่มาจริง" value={plateDraft} onChange={(e) => setPlateDraft(e.target.value)} placeholder="เช่น 70-1234" />
                <TextField size="small" label="เหตุผล (ไม่บังคับ)" value={plateReason} onChange={(e) => setPlateReason(e.target.value)} placeholder="เช่น เปลี่ยนรถ / ลูกค้ากรอกผิด" />
              </Stack>
            </DialogContent>
            <DialogActions>
              <Button color="inherit" onClick={() => setPlateOpen(false)} disabled={plateSaving}>ปิด</Button>
              <Button variant="contained" onClick={() => void savePlate()} disabled={plateSaving}>{plateSaving ? 'กำลังบันทึก…' : 'บันทึกทะเบียน'}</Button>
            </DialogActions>
          </Dialog>
          {sheet}
        </>
      ) : null}
    </Drawer>
  );
}
