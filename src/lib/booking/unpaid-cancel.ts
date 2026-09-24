/**
 * Auto-cancel of unpaid customer queues: which pending bookings the cron must
 * warn, and which it must cancel, this tick.
 *
 *   anchor   = max(created_at, document.payment_updated_at)   — the moment the queue started waiting for money
 *   deadline = min(anchor + unpaid_cancel_minutes, appointment start)
 *   warn     when now ≥ deadline − unpaid_warn_minutes and not warned yet (W > 0)
 *   cancel   when now ≥ deadline and (W = 0, or the warning went out ≥ W minutes ago)
 *
 * The second half of the cancel rule matters when the switch is turned on with
 * old pending queues, or when the admin shortens the window: the customer still
 * gets the full warning window before the queue disappears.
 *
 * Pure: the caller loads rows + settings and applies the result with the
 * `cancel_unpaid_booking` RPC / a conditional update, so a payment recorded in
 * the meantime always wins.
 */

export type UnpaidSettings = {
  unpaid_cancel_enabled: boolean;
  unpaid_cancel_minutes: number;
  unpaid_warn_minutes: number;
};

export type UnpaidCandidate = {
  id: string;
  status: string;
  booking_source: string;
  created_at: string;
  /** `external_documents.payment_updated_at` — a later paid→unpaid change restarts the clock. */
  payment_updated_at: string | null;
  booking_date: string;
  start_time: string;
  payment_warned_at: string | null;
};

export type UnpaidActions = { warn: string[]; cancel: string[] };

const MINUTE = 60_000;

function ms(iso: string | null | undefined): number {
  if (!iso) return Number.NaN;
  return new Date(iso).getTime();
}

/** Appointment start as epoch ms (Bangkok wall clock). NaN when malformed. */
export function appointmentMs(c: Pick<UnpaidCandidate, 'booking_date' | 'start_time'>): number {
  const t = c.start_time.length === 5 ? `${c.start_time}:00` : c.start_time.slice(0, 8);
  return new Date(`${c.booking_date.slice(0, 10)}T${t}+07:00`).getTime();
}

/**
 * When an unpaid queue will be cancelled, or null when the rule is off or the
 * row's dates are unreadable.
 *
 * @param c Booking timestamps (+ the document's last payment change).
 * @param settings Site settings.
 */
export function paymentDeadline(c: Pick<UnpaidCandidate, 'created_at' | 'payment_updated_at' | 'booking_date' | 'start_time'>, settings: UnpaidSettings): Date | null {
  if (!settings.unpaid_cancel_enabled) return null;
  const created = ms(c.created_at);
  if (Number.isNaN(created)) return null;
  const paymentChanged = ms(c.payment_updated_at);
  const anchor = Number.isNaN(paymentChanged) ? created : Math.max(created, paymentChanged);
  let deadline = anchor + Math.max(settings.unpaid_cancel_minutes, 0) * MINUTE;
  const start = appointmentMs(c);
  if (!Number.isNaN(start) && start < deadline) deadline = start;
  return new Date(deadline);
}

/**
 * Whether the row is one the sweep may touch at all: a pending queue that the
 * customer booked through their link. Payment status is filtered by the caller.
 */
function eligible(r: UnpaidCandidate): boolean {
  return r.status === 'pending' && r.booking_source === 'customer_link';
}

/**
 * @param rows Pending queues on unpaid SOs (other rows are ignored).
 * @param now Server clock.
 * @param settings Site settings.
 * @returns Ids to warn and ids to cancel (never both for the same row in one tick).
 */
export function computeUnpaidActions(rows: UnpaidCandidate[], now: Date, settings: UnpaidSettings): UnpaidActions {
  const out: UnpaidActions = { warn: [], cancel: [] };
  if (!settings.unpaid_cancel_enabled) return out;
  const warnWindow = Math.max(settings.unpaid_warn_minutes, 0) * MINUTE;
  const t = now.getTime();

  for (const r of rows) {
    if (!eligible(r)) continue;
    const deadline = paymentDeadline(r, settings);
    if (!deadline) continue;
    const d = deadline.getTime();
    const warned = ms(r.payment_warned_at);
    const hasWarned = !Number.isNaN(warned);

    if (warnWindow === 0) {
      if (t >= d) out.cancel.push(r.id);
      continue;
    }
    if (!hasWarned) {
      // Even when the deadline already passed, the warning goes first; the cancel follows W minutes later.
      if (t >= d - warnWindow) out.warn.push(r.id);
      continue;
    }
    if (t >= d && t >= warned + warnWindow) out.cancel.push(r.id);
  }
  return out;
}
