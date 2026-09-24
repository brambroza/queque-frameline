import type { BookingDirection, BookingStatus } from '@/types/db';
import type { StatusPaletteKey } from '@/lib/booking/status-meta';

/** One row of `/api/bookings` as rendered by the portal list, board and drawers. */
export type BookingRow = {
  id: string;
  queue_number: string;
  booking_date: string;
  start_time: string;
  end_time?: string | null;
  /** Minutes at the dock for this queue (vehicle type's duration unless the warehouse changed it). */
  service_minutes?: number | null;
  /** Turnaround kept free after this queue's end (snapshot of the vehicle type's buffer). */
  buffer_minutes?: number | null;
  status: string;
  direction: BookingDirection;
  service_id?: string | null;
  branch_id?: string | null;
  document_id?: string | null;
  customer_id?: string | null;
  /** Dock. */
  resource_id?: string | null;
  resource_name?: string | null;
  plate_number?: string | null;
  plate_number_actual?: string | null;
  driver_name?: string | null;
  driver_phone?: string | null;
  receiver_name?: string | null;
  receiver_phone?: string | null;
  note?: string | null;
  booking_source?: string | null;
  do_number?: string | null;
  do_issued_at?: string | null;
  confirmed_at?: string | null;
  arrived_at?: string | null;
  checked_in_at?: string | null;
  grace_deadline?: string | null;
  called_at?: string | null;
  call_count?: number | null;
  auto_called?: boolean | null;
  serving_started_at?: string | null;
  completed_at?: string | null;
  cancel_reason?: string | null;
  branches?: { branch_name: string } | null;
  services?: { service_name: string; duration_minutes?: number | null } | null;
  customers?: { full_name: string | null; phone: string | null; partner_type?: string | null; code?: string | null } | null;
  external_documents?: { doc_no: string; doc_type: 'so' | 'po'; payment_status?: string | null; item_count?: number | null } | null;
};

/** Vehicle type (`services` row). */
export type VehicleType = { id: string; service_name: string; duration_minutes?: number | null; buffer_minutes?: number | null; direction?: BookingDirection | null; active?: boolean | null };
/** Dock (`booking_resources` row). */
export type Dock = { id: string; resource_name: string; resource_code?: string | null; resource_type: string; branch_id?: string | null; direction?: BookingDirection | null; service_ids?: string[] | null; active?: boolean | null };
export type DocumentOption = { id: string; doc_type: 'so' | 'po'; doc_no: string; branch_id: string | null; partner_id: string | null; partner_name: string | null; status: string; branches?: { branch_name?: string | null } | null };
export type SlotOption = { slot_time: string; slot_end: string; capacity: number; remaining_capacity: number; is_past: boolean; bookable: boolean };

export const DIRECTION_META: Record<BookingDirection, { label: string; short: string; palette: StatusPaletteKey; docLabel: string }> = {
  outbound: { label: 'รับสินค้า (ลูกค้า)', short: 'รับ', palette: 'primary', docLabel: 'SO' },
  inbound: { label: 'ส่งสินค้า (Supplier)', short: 'ส่ง', palette: 'secondary', docLabel: 'PO' },
};

export const STATUS_LABEL: Record<BookingStatus, string> = {
  pending: 'รอยืนยัน',
  confirmed: 'ยืนยันแล้ว',
  late: 'เลยเวลานัด',
  checked_in: 'มาถึงแล้ว',
  called: 'กำลังเรียก',
  serving: 'กำลังขึ้น/ลงของ',
  completed: 'เสร็จสิ้น',
  cancelled: 'ยกเลิก',
  no_show: 'ไม่มา',
};

/** Statuses offered in the list filter, in flow order. */
export const FILTER_STATUSES: readonly BookingStatus[] = ['pending', 'confirmed', 'late', 'checked_in', 'called', 'serving', 'completed', 'cancelled', 'no_show'];

export type NextStatusKind = 'confirm' | 'arrive' | 'call' | 'recall' | 'uncall' | 'serve' | 'done' | 'no_show';
export type NextStatusOption = { status: BookingStatus; label: string; kind: NextStatusKind; primary: boolean; adminOnly?: boolean };

/**
 * Buttons offered per status; the first entry is the primary one. Mirrors
 * `ALLOWED_TRANSITIONS` in `src/lib/booking/status-flow.ts` — the API is the authority.
 */
export const NEXT_STATUSES: Record<string, NextStatusOption[]> = {
  pending: [{ status: 'confirmed', label: 'อนุมัติคิว + ออก DO', kind: 'confirm', primary: true }],
  confirmed: [
    { status: 'checked_in', label: 'รถมาถึงแล้ว', kind: 'arrive', primary: true },
    { status: 'no_show', label: 'ไม่มา', kind: 'no_show', primary: false },
  ],
  late: [
    { status: 'checked_in', label: 'รถมาถึงแล้ว', kind: 'arrive', primary: true },
    { status: 'no_show', label: 'ไม่มา', kind: 'no_show', primary: false },
  ],
  checked_in: [{ status: 'called', label: 'เรียกเข้าท่า', kind: 'call', primary: true }],
  called: [
    { status: 'serving', label: 'เริ่มขึ้น/ลงของ', kind: 'serve', primary: true },
    { status: 'called', label: 'เรียกซ้ำ', kind: 'recall', primary: false },
    { status: 'checked_in', label: 'ยกเลิกการเรียก', kind: 'uncall', primary: false },
    { status: 'no_show', label: 'ไม่มา', kind: 'no_show', primary: false },
  ],
  serving: [{ status: 'completed', label: 'ปิดงาน', kind: 'done', primary: true }],
};

/** Statuses staff may cancel from. Once on the dock the job is closed, not cancelled. */
export const CANCELLABLE = new Set<string>(['pending', 'confirmed', 'late', 'checked_in']);

/** Statuses that can still be moved to another slot or dock. */
export const MOVABLE = new Set<string>(['pending', 'confirmed', 'late']);

/** Kanban columns of `/portal/queue-board`; `tone` colours the column header and count. */
export const QUEUE_COLUMNS: Array<{ key: string; label: string; statuses: BookingStatus[]; tone: StatusPaletteKey }> = [
  { key: 'pending', label: 'รอยืนยัน', statuses: ['pending'], tone: 'warning' },
  { key: 'expected', label: 'รอรถมาถึง', statuses: ['confirmed', 'late'], tone: 'primary' },
  { key: 'yard', label: 'มาถึงแล้ว · รอเรียก', statuses: ['checked_in'], tone: 'secondary' },
  { key: 'called', label: 'กำลังเรียกเข้าท่า', statuses: ['called'], tone: 'info' },
  { key: 'serving', label: 'กำลังขึ้น/ลงของ', statuses: ['serving'], tone: 'success' },
  { key: 'done', label: 'เสร็จวันนี้', statuses: ['completed'], tone: 'default' },
];

/**
 * Card colour per status on the queue board. Differs from `STATUS_META` where two
 * statuses share a palette but sit side by side here (late vs pending, completed vs serving).
 */
export const BOARD_CARD_TONE: Record<string, StatusPaletteKey> = {
  pending: 'warning',
  confirmed: 'primary',
  late: 'error',
  checked_in: 'secondary',
  called: 'info',
  serving: 'success',
  completed: 'default',
};

/** Partner name shown in lists; `-` when the row has no partner. */
export function customerName(b: Pick<BookingRow, 'customers'>): string {
  return b.customers?.full_name?.trim() || '-';
}

export function customerPhone(b: Pick<BookingRow, 'customers'>): string {
  return b.customers?.phone ?? '';
}

/** `HH:MM` from a DB `time` value. */
export function hhmm(time: string | null | undefined): string {
  return String(time ?? '').slice(0, 5);
}

/** Add `days` to an ISO `YYYY-MM-DD` date (UTC arithmetic, so no DST surprises). */
export function addDays(iso: string, days: number): string {
  const [y, mo, d] = iso.split('-').map(Number);
  if (!y || !mo || !d) return iso;
  return new Date(Date.UTC(y, mo - 1, d + days)).toISOString().slice(0, 10);
}
