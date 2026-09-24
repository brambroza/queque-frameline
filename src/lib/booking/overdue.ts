/**
 * Overdue sweep: which bookings the cron must move on its own.
 *
 *   confirmed ─(now > grace_deadline)────────────────────────────▶ late
 *   late      ─(now > grace_deadline + grace, if site allows)────▶ no_show
 *   called    ─(now > called_timeout_at)─────────────────────────▶ no_show
 *
 * Pure: the caller loads rows + settings and applies the result with a
 * conditional update (`where status = <from>`), so a concurrent staff action wins.
 */
import type { BookingStatus } from '@/types/db';

export type OverdueSettings = {
  grace_minutes: number;
  auto_no_show_after_grace: boolean;
};

export type OverdueCandidate = {
  id: string;
  status: string;
  grace_deadline: string | null;
  called_timeout_at: string | null;
};

export type OverdueMove = { id: string; from: BookingStatus; to: BookingStatus; reason: 'grace_passed' | 'grace_doubled' | 'call_timeout' };

function after(now: Date, iso: string | null, extraMinutes = 0): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  return now.getTime() > t + extraMinutes * 60_000;
}

export type WaitNoticeSettings = {
  wait_notice_enabled: boolean;
  wait_notice_minutes: number;
};

export type WaitNoticeCandidate = {
  id: string;
  status: string;
  booking_date: string;
  start_time: string;
  wait_notified_at: string | null;
};

/** Appointment start as epoch ms (Bangkok). NaN when malformed. */
function appointmentMs(c: Pick<WaitNoticeCandidate, 'booking_date' | 'start_time'>): number {
  const t = c.start_time.length === 5 ? `${c.start_time}:00` : c.start_time.slice(0, 8);
  return new Date(`${c.booking_date.slice(0, 10)}T${t}+07:00`).getTime();
}

/**
 * "กรุณารอสักครู่": checked-in trucks whose appointment start passed
 * `wait_notice_minutes` ago and that are still not called (the dock is busy).
 * One notice per booking — the caller stamps `wait_notified_at` conditionally.
 *
 * @param rows Live bookings (any status; only `checked_in` without a stamp qualify).
 * @param now Server clock.
 * @param settings Site settings.
 * @returns Ids to notify.
 */
export function computeWaitNotices(rows: WaitNoticeCandidate[], now: Date, settings: WaitNoticeSettings): string[] {
  if (!settings.wait_notice_enabled) return [];
  const delayMs = Math.max(settings.wait_notice_minutes, 0) * 60_000;
  return rows
    .filter((r) => r.status === 'checked_in' && !r.wait_notified_at)
    .filter((r) => {
      const start = appointmentMs(r);
      return !Number.isNaN(start) && now.getTime() >= start + delayMs;
    })
    .map((r) => r.id);
}

/**
 * @param rows Live bookings of the site (any status; irrelevant ones are ignored).
 * @param now Server clock.
 * @param settings Site settings.
 * @returns One move per overdue booking.
 */
export function computeOverdueMoves(rows: OverdueCandidate[], now: Date, settings: OverdueSettings): OverdueMove[] {
  const moves: OverdueMove[] = [];
  for (const r of rows) {
    if (r.status === 'confirmed' && after(now, r.grace_deadline)) {
      // Always pass through `late` first, even when far overdue: the next tick
      // takes it to no_show, and the audit log shows both steps.
      moves.push({ id: r.id, from: 'confirmed', to: 'late', reason: 'grace_passed' });
    } else if (r.status === 'late' && settings.auto_no_show_after_grace && after(now, r.grace_deadline, settings.grace_minutes)) {
      moves.push({ id: r.id, from: 'late', to: 'no_show', reason: 'grace_doubled' });
    } else if (r.status === 'called' && after(now, r.called_timeout_at)) {
      moves.push({ id: r.id, from: 'called', to: 'no_show', reason: 'call_timeout' });
    }
  }
  return moves;
}
