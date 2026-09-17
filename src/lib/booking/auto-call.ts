/**
 * Auto-call: decide which waiting vehicle goes to which free dock.
 *
 * A dock is free when nothing on it is `called` or `serving`. A vehicle is a
 * candidate when it is `checked_in` (physically in the yard). Each booking
 * already has a dock from booking time (`resource_id`); it is called to that
 * dock when free. A booking without a dock takes any free dock that fits its
 * direction and vehicle type. Earliest appointment first, then earliest arrival.
 *
 * Pure: the runner loads state, applies picks with `where status = 'checked_in'`.
 */
import type { AutoCallMode, BookingDirection } from '@/types/db';

export type DockState = {
  id: string;
  direction: BookingDirection | null;
  /** Vehicle types allowed; null/empty = all. */
  service_ids: string[] | null;
  /** Something is called or serving here. */
  busy: boolean;
};

export type CallCandidate = {
  id: string;
  resource_id: string | null;
  service_id: string;
  direction: BookingDirection;
  booking_date: string;
  start_time: string;
  checked_in_at: string | null;
};

export type AutoCallSettings = {
  auto_call_mode: AutoCallMode;
  /** `time` / `hybrid`: do not call earlier than start_time − lead. */
  auto_call_lead_minutes: number;
};

export type CallPick = { bookingId: string; dockId: string; assignDock: boolean };

function dockFits(d: DockState, c: CallCandidate): boolean {
  if (d.direction && d.direction !== c.direction) return false;
  if (d.service_ids && d.service_ids.length > 0 && !d.service_ids.includes(c.service_id)) return false;
  return true;
}

function startMs(c: CallCandidate): number {
  const t = c.start_time.length === 5 ? `${c.start_time}:00` : c.start_time.slice(0, 8);
  return new Date(`${c.booking_date}T${t}+07:00`).getTime();
}

function byPriority(a: CallCandidate, b: CallCandidate): number {
  const s = startMs(a) - startMs(b);
  if (s !== 0) return s;
  const ca = a.checked_in_at ? new Date(a.checked_in_at).getTime() : Number.MAX_SAFE_INTEGER;
  const cb = b.checked_in_at ? new Date(b.checked_in_at).getTime() : Number.MAX_SAFE_INTEGER;
  if (ca !== cb) return ca - cb;
  return a.id.localeCompare(b.id);
}

/**
 * @param docks Every active dock with its busy flag.
 * @param candidates `checked_in` bookings of today.
 * @param now Server clock.
 * @param settings Site auto-call settings.
 * @param onlyDockId Event path: restrict to the dock that was just released.
 * @returns At most one pick per free dock.
 */
export function pickNextToCall(
  docks: DockState[],
  candidates: CallCandidate[],
  now: Date,
  settings: AutoCallSettings,
  onlyDockId?: string | null,
): CallPick[] {
  if (settings.auto_call_mode === 'off') return [];
  const timeGated = settings.auto_call_mode === 'time';
  const leadMs = Math.max(settings.auto_call_lead_minutes, 0) * 60_000;

  const queue = candidates
    .filter((c) => !timeGated || now.getTime() >= startMs(c) - leadMs)
    .sort(byPriority);

  const taken = new Set<string>();
  const picks: CallPick[] = [];
  const free = docks.filter((d) => !d.busy && (!onlyDockId || d.id === onlyDockId));

  for (const dock of free) {
    // 1) the earliest vehicle booked onto this dock, 2) else the earliest dock-less vehicle that fits.
    const own = queue.find((c) => !taken.has(c.id) && c.resource_id === dock.id);
    const floating = own ? undefined : queue.find((c) => !taken.has(c.id) && !c.resource_id && dockFits(dock, c));
    const chosen = own ?? floating;
    if (!chosen) continue;
    taken.add(chosen.id);
    picks.push({ bookingId: chosen.id, dockId: dock.id, assignDock: !chosen.resource_id });
  }
  return picks;
}
