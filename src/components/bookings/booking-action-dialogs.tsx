'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, InputLabel, MenuItem, Select, Stack, TextField, Typography,
} from '@mui/material';
import { PAYMENT_BLOCK_MESSAGE, PAYMENT_COLOR, PAYMENT_LABEL, PAYMENT_STATUSES, isPaymentCleared, isPaymentStatus, type PaymentStatus } from '@/lib/booking/payment';
import { suggestServiceMinutes, type ItemMinutesRule, type SuggestedMinutes } from '@/lib/booking/suggest-minutes';
import { labelOfMinutes, type DockDay } from '@/lib/booking/dock-day';
import { SIGNATURE_NAME_MAX, SIGNATURE_PARTY_LABEL, type SignatureInput, type SignatureParty } from '@/lib/booking/signatures';
import { SignaturePad, type SignaturePadHandle } from '@/components/ui/signature-pad';
import { customerName, hhmm, type BookingRow } from './booking-types';
import { DockDayTimeline } from './dock-day-timeline';

/** Payment status of the SO behind a queue; null when the queue is not gated (PO / no document). */
export function paymentOf(b: Pick<BookingRow, 'external_documents'>): PaymentStatus | null {
  const doc = b.external_documents;
  if (!doc || doc.doc_type !== 'so') return null;
  return isPaymentStatus(doc.payment_status) ? doc.payment_status : 'unpaid';
}

/** True when approval is blocked because the SO is not paid. */
export function isPaymentBlocked(b: Pick<BookingRow, 'external_documents'>): boolean {
  const doc = b.external_documents;
  return !isPaymentCleared(doc?.doc_type ?? null, doc?.payment_status ?? null);
}

/** Small chip for lists: shown for SO queues only. */
export function PaymentChip({ status, size = 'small' }: { status: PaymentStatus | null; size?: 'small' | 'medium' }) {
  if (!status) return null;
  return <Chip size={size} color={PAYMENT_COLOR[status]} variant={status === 'unpaid' ? 'filled' : 'outlined'} label={status === 'unpaid' ? 'รอชำระเงิน' : PAYMENT_LABEL[status]} />;
}

/** "13:00" + minutes → "14:30"; null when it would pass midnight. */
function endTimeLabel(start: string, minutes: number): string | null {
  const [h, m] = start.split(':').map(Number);
  const total = h * 60 + m + minutes;
  if (!Number.isFinite(total) || total >= 24 * 60) return null;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/** Minutes the queue currently holds its dock: stored value, else start→end, else the vehicle type's time. */
export function minutesOf(b: BookingRow): number {
  if (b.service_minutes) return b.service_minutes;
  if (b.end_time) {
    const [sh, sm] = b.start_time.split(':').map(Number);
    const [eh, em] = b.end_time.split(':').map(Number);
    const diff = eh * 60 + em - (sh * 60 + sm);
    if (diff > 0) return diff;
  }
  return b.services?.duration_minutes ?? 30;
}

/** Dock time suggested for a queue: item lines x minutes-per-item, else the vehicle type's time. */
export function suggestionOf(b: BookingRow, rule: ItemMinutesRule | undefined): SuggestedMinutes {
  return suggestServiceMinutes({
    itemCount: b.external_documents?.item_count ?? 0,
    minutesPerItem: rule?.minutesPerItem,
    enabled: rule?.enabled ?? false,
    vehicleMinutes: b.services?.duration_minutes ?? null,
  });
}

export const QUICK_MINUTES = [30, 45, 60, 90, 120, 180];

/** True when `n` minutes would run into the next queue on the dock (only once the day has loaded). */
export function overDockLimit(day: DockDay | null, n: number): boolean {
  return day !== null && Number.isFinite(n) && n > day.maxMinutes;
}

/** Minutes valid for the field and, when the dock's day is known, fitting before the next queue. */
export function minutesFit(booking: BookingRow, day: DockDay | null, n: number): boolean {
  return Number.isInteger(n) && n >= 5 && n <= 1440 && Boolean(endTimeLabel(booking.start_time, n)) && !overDockLimit(day, n);
}

/**
 * Minutes-at-the-dock editor shared by the approve and the adjust dialogs.
 * The vehicle type's duration is only the starting value. The dock's day is
 * drawn underneath so the warehouse sees how far the stay can stretch.
 */
function MinutesField({ booking, value, onChange, itemMinutes, day, onDay }: {
  booking: BookingRow; value: string; onChange: (v: string) => void; itemMinutes?: ItemMinutesRule; day: DockDay | null; onDay: (day: DockDay | null) => void;
}) {
  const n = Number(value);
  const valid = Number.isInteger(n) && n >= 5 && n <= 1440;
  const end = valid ? endTimeLabel(booking.start_time, n) : null;
  const over = overDockLimit(day, n);
  const typeDefault = booking.services?.duration_minutes ?? null;
  const suggestion = suggestionOf(booking, itemMinutes);
  const lines = booking.external_documents?.item_count ?? 0;
  const nextLabel = day?.next ? `ชน ${day.next.queue_number}` : 'เกินสิ้นวัน';
  return (
    <Stack spacing={1}>
      {suggestion.source === 'items' ? (
        <Chip
          size="small"
          color="info"
          variant={n === suggestion.minutes ? 'filled' : 'outlined'}
          disabled={overDockLimit(day, suggestion.minutes)}
          label={`แนะนำตามรายการ: ${lines} รายการ × ${itemMinutes?.minutesPerItem ?? 10} นาที = ${suggestion.minutes} นาที${overDockLimit(day, suggestion.minutes) ? ` · ${nextLabel}` : ''}`}
          onClick={() => onChange(String(suggestion.minutes))}
          sx={{ alignSelf: 'flex-start' }}
        />
      ) : null}
      <TextField
        id="booking-service-minutes"
        label="เวลาที่ท่า (นาที)"
        type="number"
        size="small"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        error={!valid || (valid && !end) || over}
        helperText={
          !valid ? 'ใส่ 5–1440 นาที'
            : !end ? 'เวลาสิ้นสุดข้ามวัน — ลดเวลาลง'
              : over && day ? `${nextLabel} — สูงสุด ${day.maxMinutes} นาที (ถึง ${labelOfMinutes(day.startMin + day.maxMinutes)} น.)`
                : `${hhmm(booking.start_time)} – ${end} น.${typeDefault ? ` · ค่าตั้งต้นของ${booking.services?.service_name ?? 'ประเภทรถ'} ${typeDefault} นาที` : ''}`
        }
        slotProps={{ htmlInput: { min: 5, max: 1440, step: 5 } }}
      />
      <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
        {QUICK_MINUTES.map((m) => {
          const blocked = overDockLimit(day, m);
          return (
            <Chip
              key={m}
              size="small"
              label={blocked ? `${m} นาที · ${nextLabel}` : `${m} นาที`}
              variant={n === m ? 'filled' : 'outlined'}
              color={n === m ? 'primary' : 'default'}
              disabled={blocked}
              onClick={() => onChange(String(m))}
            />
          );
        })}
      </Stack>
      <DockDayTimeline bookingId={booking.id} minutes={n} onPick={(m) => onChange(String(m))} onDay={onDay} />
    </Stack>
  );
}

function Summary({ b }: { b: BookingRow }) {
  return (
    <Stack spacing={0.25}>
      <Typography fontWeight={800}>{b.queue_number} · {customerName(b)}</Typography>
      <Typography variant="body2" color="text.secondary">
        {b.external_documents?.doc_no ? `${b.external_documents.doc_no} · ` : ''}{b.booking_date} {hhmm(b.start_time)} น. · {b.resource_name ?? 'ยังไม่ระบุท่า'} · {b.services?.service_name ?? '-'}
      </Typography>
    </Stack>
  );
}

/** Approve a pending queue (issues the DO). The warehouse may set the real dock time here. */
export function ApproveDialog({ booking, saving, onClose, onSubmit, itemMinutes }: {
  booking: BookingRow | null; saving: boolean; onClose: () => void; onSubmit: (b: BookingRow, serviceMinutes: number) => void; itemMinutes?: ItemMinutesRule;
}) {
  const [minutes, setMinutes] = useState('');
  const [day, setDay] = useState<DockDay | null>(null);
  const ruleEnabled = itemMinutes?.enabled ?? false;
  const perItem = itemMinutes?.minutesPerItem;
  // Item lines win over the vehicle-type snapshot, but never over a time somebody already set by hand.
  useEffect(() => {
    if (!booking) return;
    setDay(null);
    const current = minutesOf(booking);
    const untouched = current === (booking.services?.duration_minutes ?? current);
    const suggestion = suggestionOf(booking, { enabled: ruleEnabled, minutesPerItem: perItem ?? 10 });
    setMinutes(String(suggestion.source === 'items' && untouched ? suggestion.minutes : current));
  }, [booking, ruleEnabled, perItem]);
  if (!booking) return null;
  const n = Number(minutes);
  const blocked = isPaymentBlocked(booking);
  const valid = minutesFit(booking, day, n);
  return (
    <Dialog open onClose={saving ? undefined : onClose} fullWidth maxWidth="xs">
      <DialogTitle>อนุมัติคิว + ออก DO</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 0.5 }}>
          <Summary b={booking} />
          {blocked ? <Alert severity="error">{PAYMENT_BLOCK_MESSAGE}</Alert> : null}
          <MinutesField booking={booking} value={minutes} onChange={setMinutes} itemMinutes={itemMinutes} day={day} onDay={setDay} />
          <Typography variant="caption" color="text.secondary">
            {suggestionOf(booking, itemMinutes).source === 'items' ? 'เวลาตามจำนวนรายการสินค้าเป็นค่าเบื้องต้น' : 'เวลาตามประเภทรถเป็นค่าเบื้องต้น'} ปรับตามเวลาหยิบสินค้าจริงได้ — ระบบจะกันท่าตามเวลานี้
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>ปิด</Button>
        <Button variant="contained" disabled={saving || blocked || !valid} onClick={() => onSubmit(booking, n)}>{saving ? 'กำลังอนุมัติ…' : 'อนุมัติ + ออก DO'}</Button>
      </DialogActions>
    </Dialog>
  );
}

const CANCEL_REASONS = ['ลูกค้าขอยกเลิก', 'ยังไม่ชำระเงิน', 'สินค้าไม่พร้อม', 'ลูกค้าขอเลื่อนไปจองใหม่', 'จองซ้ำ / ข้อมูลผิด'];

/** Cancel a queue. A reason is mandatory: the customer sees it and it goes into the audit log. */
export function CancelDialog({ booking, saving, onClose, onSubmit }: {
  booking: BookingRow | null; saving: boolean; onClose: () => void; onSubmit: (b: BookingRow, reason: string) => void;
}) {
  const [reason, setReason] = useState('');
  useEffect(() => { if (booking) setReason(''); }, [booking]);
  if (!booking) return null;
  const trimmed = reason.trim();
  return (
    <Dialog open onClose={saving ? undefined : onClose} fullWidth maxWidth="xs">
      <DialogTitle>ยกเลิกคิวนี้?</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 0.5 }}>
          <Summary b={booking} />
          <Alert severity="warning">ช่วงเวลาและท่าจะว่างให้คิวอื่นทันที ลูกค้าจะเห็นสถานะยกเลิกพร้อมเหตุผลในลิงก์ของตน{booking.do_number ? ` · DO ${booking.do_number} จะใช้ไม่ได้` : ''}</Alert>
          <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
            {CANCEL_REASONS.map((r) => (
              <Chip key={r} size="small" label={r} variant={trimmed === r ? 'filled' : 'outlined'} color={trimmed === r ? 'error' : 'default'} onClick={() => setReason(r)} />
            ))}
          </Stack>
          <TextField
            id="booking-cancel-reason"
            label="เหตุผลที่ยกเลิก"
            required
            multiline
            minRows={2}
            size="small"
            value={reason}
            onChange={(e) => setReason(e.target.value.slice(0, 300))}
            helperText={trimmed.length < 3 ? 'ต้องระบุเหตุผล (อย่างน้อย 3 ตัวอักษร)' : `${trimmed.length}/300`}
            error={reason.length > 0 && trimmed.length < 3}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>ไม่ยกเลิก</Button>
        <Button color="error" variant="contained" disabled={saving || trimmed.length < 3} onClick={() => onSubmit(booking, trimmed)}>{saving ? 'กำลังยกเลิก…' : 'ยกเลิกคิว'}</Button>
      </DialogActions>
    </Dialog>
  );
}

/** Sign-off sent with the close; a party is omitted when nobody drew in its box. */
export type BookingSignatures = Partial<Record<SignatureParty, SignatureInput>>;

function SignatureBlock({ party, name, onName, padRef, onInk, disabled, hint }: {
  party: SignatureParty; name: string; onName: (v: string) => void; padRef: React.RefObject<SignaturePadHandle | null>; onInk: (v: boolean) => void; disabled: boolean; hint: string;
}) {
  return (
    <Stack spacing={1} sx={{ flex: 1, minWidth: 0 }}>
      <Typography variant="subtitle2" fontWeight={700}>{SIGNATURE_PARTY_LABEL[party]}</Typography>
      <TextField
        id={`signature-name-${party}`}
        size="small"
        label="ชื่อผู้ลงชื่อ"
        value={name}
        onChange={(e) => onName(e.target.value.slice(0, SIGNATURE_NAME_MAX))}
        disabled={disabled}
        helperText={hint}
      />
      <SignaturePad ref={padRef} height={150} disabled={disabled} onChange={onInk} label={`ลายเซ็น${SIGNATURE_PARTY_LABEL[party]}`} />
    </Stack>
  );
}

/**
 * Close the job ("ปิดงาน") with an optional sign-off from the warehouse officer
 * and the customer / driver on the same tablet. A box with ink needs a name;
 * an empty box is simply not sent, so closing never blocks on a signature.
 */
export function CompleteDialog({ booking, saving, onClose, onSubmit }: {
  booking: BookingRow | null; saving: boolean; onClose: () => void; onSubmit: (b: BookingRow, signatures: BookingSignatures) => void;
}) {
  const staffPad = useRef<SignaturePadHandle | null>(null);
  const customerPad = useRef<SignaturePadHandle | null>(null);
  const [staffName, setStaffName] = useState('');
  const [customerName_, setCustomerName] = useState('');
  const [staffInk, setStaffInk] = useState(false);
  const [customerInk, setCustomerInk] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Prefill: the signed-in officer's name and the driver on the booking.
  useEffect(() => {
    if (!booking) return undefined;
    setCustomerName(booking.driver_name ?? '');
    setStaffInk(false);
    setCustomerInk(false);
    setError(null);
    let alive = true;
    fetch('/api/me-profile', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j: { data?: { full_name?: string | null; email?: string | null } }) => { if (alive) setStaffName(j.data?.full_name ?? j.data?.email ?? ''); })
      .catch(() => { if (alive) setStaffName(''); });
    return () => { alive = false; };
  }, [booking]);

  if (!booking) return null;
  const staffNeedsName = staffInk && !staffName.trim();
  const customerNeedsName = customerInk && !customerName_.trim();
  const anySigned = staffInk || customerInk;

  function submit() {
    if (!booking) return;
    if (staffNeedsName || customerNeedsName) { setError('กรอกชื่อผู้ลงชื่อของช่องที่เซ็นแล้ว'); return; }
    const out: BookingSignatures = {};
    const staffImage = staffInk ? staffPad.current?.toDataUrl() : null;
    const customerImage = customerInk ? customerPad.current?.toDataUrl() : null;
    if (staffImage) out.staff = { name: staffName.trim(), image: staffImage };
    if (customerImage) out.customer = { name: customerName_.trim(), image: customerImage };
    setError(null);
    onSubmit(booking, out);
  }

  return (
    <Dialog open onClose={saving ? undefined : onClose} fullWidth maxWidth="md">
      <DialogTitle>ปิดงาน · {booking.queue_number}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 0.5 }}>
          <Summary b={booking} />
          <Alert severity="info">ให้เจ้าหน้าที่คลังและลูกค้า/คนขับลงชื่อยืนยันว่าขึ้น-ลงสินค้าเรียบร้อย ลายเซ็นจะพิมพ์บนใบ DO · ถ้ายังไม่สะดวก ปิดงานโดยไม่ลงชื่อได้</Alert>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <SignatureBlock party="staff" name={staffName} onName={setStaffName} padRef={staffPad} onInk={setStaffInk} disabled={saving} hint={staffNeedsName ? 'ต้องกรอกชื่อเมื่อลงลายเซ็น' : 'ผู้ปิดงานหน้าท่า'} />
            <SignatureBlock party="customer" name={customerName_} onName={setCustomerName} padRef={customerPad} onInk={setCustomerInk} disabled={saving} hint={customerNeedsName ? 'ต้องกรอกชื่อเมื่อลงลายเซ็น' : 'คนขับหรือผู้รับ/ส่งสินค้า'} />
          </Stack>
          {error ? <Alert severity="error">{error}</Alert> : null}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ flexWrap: 'wrap', gap: 0.5 }}>
        <Button onClick={onClose} disabled={saving}>ยังไม่ปิด</Button>
        {!anySigned ? <Button color="inherit" disabled={saving} onClick={submit}>ปิดงานโดยไม่ลงชื่อ</Button> : null}
        <Button variant="contained" disabled={saving || !anySigned || staffNeedsName || customerNeedsName} onClick={submit}>{saving ? 'กำลังปิดงาน…' : 'ลงชื่อและปิดงาน'}</Button>
      </DialogActions>
    </Dialog>
  );
}

export type PaymentTarget = { id: string; doc_no: string; partner_name: string | null; payment_status?: string | null; payment_ref?: string | null; payment_note?: string | null };

/**
 * Record an SO's payment (admin + warehouse staff). Saves through
 * `/api/documents/[id]/payment`; `onSaved` gets the queues that became approvable.
 */
export function PaymentDialog({ target, onClose, onSaved }: {
  target: PaymentTarget | null; onClose: () => void; onSaved: (result: { payment_status: PaymentStatus; unlocked: string[] }) => void;
}) {
  const [status, setStatus] = useState<PaymentStatus>('unpaid');
  const [ref, setRef] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const current = useMemo<PaymentStatus>(() => (isPaymentStatus(target?.payment_status) ? target.payment_status : 'unpaid'), [target]);

  useEffect(() => {
    if (!target) return;
    // Opening the dialog on an unpaid SO almost always means "it has been paid now".
    setStatus(current === 'unpaid' ? 'paid' : current);
    setRef(target.payment_ref ?? '');
    setNote(target.payment_note ?? '');
    setError(null);
  }, [target, current]);

  if (!target) return null;

  async function save() {
    if (!target || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/documents/${target.id}/payment`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payment_status: status, payment_ref: ref, payment_note: note }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string; data?: { payment_status: PaymentStatus; unlocked_queues?: string[] } };
      if (!res.ok || !j.data) { setError(j.error ?? 'บันทึกการชำระเงินไม่สำเร็จ'); return; }
      onSaved({ payment_status: j.data.payment_status, unlocked: j.data.unlocked_queues ?? [] });
    } catch {
      setError('เชื่อมต่อไม่ได้ กรุณาลองใหม่');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onClose={saving ? undefined : onClose} fullWidth maxWidth="xs">
      <DialogTitle>บันทึกการชำระเงิน · {target.doc_no}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 0.5 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="body2" color="text.secondary">{target.partner_name ?? '-'} · ปัจจุบัน</Typography>
            <Chip size="small" color={PAYMENT_COLOR[current]} label={PAYMENT_LABEL[current]} />
          </Stack>
          <FormControl size="small" fullWidth>
            <InputLabel id="payment-status-label">สถานะการชำระเงิน</InputLabel>
            <Select id="payment-status" labelId="payment-status-label" label="สถานะการชำระเงิน" value={status} onChange={(e) => setStatus(e.target.value as PaymentStatus)}>
              {PAYMENT_STATUSES.map((s) => <MenuItem key={s} value={s}>{PAYMENT_LABEL[s]}{s === 'credit' ? ' (ลูกค้าเครดิต — อนุมัติคิวได้)' : ''}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField id="payment-ref" size="small" label="เลขอ้างอิง (ไม่บังคับ)" placeholder="เลขใบเสร็จ / เลขที่โอน" value={ref} onChange={(e) => setRef(e.target.value.slice(0, 80))} />
          <TextField id="payment-note" size="small" label="หมายเหตุ (ไม่บังคับ)" value={note} onChange={(e) => setNote(e.target.value.slice(0, 300))} multiline minRows={2} />
          {status === 'unpaid' ? <Alert severity="info">คิวของ SO นี้จะอนุมัติไม่ได้จนกว่าจะเป็น “ชำระแล้ว” หรือ “เครดิต”</Alert> : null}
          {error ? <Alert severity="error">{error}</Alert> : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>ปิด</Button>
        <Button variant="contained" disabled={saving} onClick={() => void save()}>{saving ? 'กำลังบันทึก…' : 'บันทึก'}</Button>
      </DialogActions>
    </Dialog>
  );
}
