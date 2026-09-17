import { customerLabel } from '@/lib/booking/customer-label';

/** One row of `/api/bookings` as rendered by the portal list. */
export type BookingRow = {
  id: string;
  queue_number: string;
  booking_date: string;
  start_time: string;
  end_time?: string | null;
  status: string;
  resource_id?: string | null;
  resource_name?: string | null;
  note?: string | null;
  service_id?: string | null;
  branch_id?: string | null;
  /** FK to `line_users.id`; present when the customer booked through LINE. */
  line_user_id?: string | null;
  change_notified_at?: string | null;
  change_acknowledged_at?: string | null;
  /** Set when the customer tapped "ฉันมาถึงแล้ว" in LIFF. */
  checked_in_at?: string | null;
  called_at?: string | null;
  call_count?: number | null;
  branches?: { branch_name: string } | null;
  services?: { service_name: string } | null;
  customers?: { full_name: string; nickname?: string | null; phone: string } | null;
};

export type Branch = { id: string; branch_name: string };
export type Service = { id: string; service_name: string; price?: number | null };
export type LineUser = {
  id: string;
  line_user_id: string;
  display_name: string | null;
  picture_url?: string | null;
  /** Customer nickname (customers.nickname) linked to this LINE user, if any. */
  nickname?: string | null;
};
export type Resource = {
  id: string;
  resource_name: string;
  resource_code?: string | null;
  capacity: number;
  resource_type: string;
  branch_id?: string | null;
  active?: boolean | null;
  /** Services this resource serves; empty / null = every service. */
  service_ids?: string[] | null;
};

/** Statuses offered in the list filter, in booking-flow order. */
export const FILTER_STATUSES = ['pending', 'pending_approval', 'confirmed', 'checked_in', 'waiting', 'called', 'serving', 'completed', 'cancelled', 'no_show'] as const;

export type NextStatusKind = 'approve' | 'confirm' | 'wait' | 'call' | 'recall' | 'serve' | 'done' | 'no_show';

export type NextStatusOption = { status: string; label: string; kind: NextStatusKind; primary: boolean };

/**
 * Transitions a staff member can trigger from each status, first entry is the primary one.
 *
 * `call` / `recall` write `called` — the API stamps `called_at` + `call_count`
 * and pushes "ถึงคิวของคุณแล้ว" to the customer's LINE. `approve` confirms a
 * `pending_approval` request and pushes the approval Flex.
 */
export const NEXT_STATUSES: Record<string, NextStatusOption[]> = {
  pending: [
    { status: 'confirmed', label: 'ยืนยัน', kind: 'confirm', primary: true },
    { status: 'no_show', label: 'ไม่มา', kind: 'no_show', primary: false },
  ],
  pending_approval: [{ status: 'confirmed', label: 'อนุมัติ', kind: 'approve', primary: true }],
  confirmed: [
    { status: 'called', label: 'เรียกคิว', kind: 'call', primary: true },
    { status: 'waiting', label: 'รอเรียก', kind: 'wait', primary: false },
    { status: 'no_show', label: 'ไม่มา', kind: 'no_show', primary: false },
  ],
  checked_in: [
    { status: 'called', label: 'เรียกคิว', kind: 'call', primary: true },
    { status: 'waiting', label: 'รอเรียก', kind: 'wait', primary: false },
    { status: 'no_show', label: 'ไม่มา', kind: 'no_show', primary: false },
  ],
  waiting: [
    { status: 'called', label: 'เรียกคิว', kind: 'call', primary: true },
    { status: 'serving', label: 'เริ่มบริการ', kind: 'serve', primary: false },
    { status: 'no_show', label: 'ไม่มา', kind: 'no_show', primary: false },
  ],
  called: [
    { status: 'serving', label: 'เริ่มบริการ', kind: 'serve', primary: true },
    { status: 'called', label: 'เรียกซ้ำ', kind: 'recall', primary: false },
    { status: 'no_show', label: 'ไม่มา', kind: 'no_show', primary: false },
  ],
  serving: [{ status: 'completed', label: 'เสร็จสิ้น', kind: 'done', primary: true }],
};

export const CANCELLABLE = new Set(['pending', 'pending_approval', 'confirmed', 'checked_in', 'waiting', 'called', 'serving']);

/** Statuses that can still be moved to another slot or resource. */
export const MOVABLE = new Set(['pending', 'pending_approval', 'confirmed', 'checked_in', 'waiting']);

export type ChangeAckState = 'none' | 'pending' | 'acked';

/**
 * Whether the customer has acknowledged the latest shop-initiated change.
 * `none` = never notified (walk-in or never moved).
 */
export function changeAckState(b: Pick<BookingRow, 'change_notified_at' | 'change_acknowledged_at'>): ChangeAckState {
  if (!b.change_notified_at) return 'none';
  if (!b.change_acknowledged_at) return 'pending';
  return new Date(b.change_acknowledged_at).getTime() >= new Date(b.change_notified_at).getTime() ? 'acked' : 'pending';
}

/** Customer name shown in the list — "ชื่อเล่น (ชื่อจริง)" when a nickname is set, `-` with no customer row. */
export function customerName(b: BookingRow): string {
  return customerLabel(b.customers);
}

/** Customer phone or empty string. */
export function customerPhone(b: BookingRow): string {
  return b.customers?.phone ?? '';
}

/** `HH:MM` from a DB `time` value. */
export function hhmm(time: string | null | undefined): string {
  return String(time ?? '').slice(0, 5);
}

/**
 * Shift an `HH:MM` label by `deltaMinutes`, clamped to the same day.
 * Returns the input unchanged when it is not a valid label.
 */
export function shiftTime(time: string, deltaMinutes: number): string {
  const m = /^(\d{2}):(\d{2})$/.exec(time);
  if (!m) return time;
  const total = Number(m[1]) * 60 + Number(m[2]) + deltaMinutes;
  const clamped = Math.min(23 * 60 + 59, Math.max(0, total));
  return `${String(Math.floor(clamped / 60)).padStart(2, '0')}:${String(clamped % 60).padStart(2, '0')}`;
}

/**
 * Add `days` to an ISO `YYYY-MM-DD` date (UTC arithmetic, so no DST surprises).
 */
export function addDays(iso: string, days: number): string {
  const [y, mo, d] = iso.split('-').map(Number);
  if (!y || !mo || !d) return iso;
  const dt = new Date(Date.UTC(y, mo - 1, d + days));
  return dt.toISOString().slice(0, 10);
}
