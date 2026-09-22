/**
 * What one queue can do with its dock for the rest of the day. Mirrors the
 * DB rule in `booking_end_for_minutes` / `is_dock_free`: this queue blocks
 * `start .. start + minutes + its own buffer`, every other live queue blocks
 * `start .. end + its buffer`, and two blocks on the same dock may not overlap.
 * Breaks and closing time are shown but never enforced (the warehouse decides).
 * Pure so the dialog can recompute on every keystroke without a round trip.
 */

/** Statuses that no longer hold a dock — same list as `is_dock_free`. */
export const DOCK_RELEASED_STATUSES: readonly string[] = ['cancelled', 'no_show', 'skipped', 'completed'];

/** Fallback length when a queue has no `end_time`, as `is_dock_free` assumes. */
const DEFAULT_OTHER_MINUTES = 30;
/** Bar bounds when the day has no working hours row. */
const FALLBACK_OPEN = 6 * 60;
const FALLBACK_CLOSE = 20 * 60;
const DAY_END = 24 * 60;

export type DockDayOther = {
  id: string;
  queue_number: string;
  start_time: string;
  end_time: string | null;
  buffer_minutes: number | null;
  status: string;
  customer_name?: string | null;
};

export type DockDayInput = {
  /** This queue's start (`HH:MM` or `HH:MM:SS`). */
  start_time: string;
  /** This queue's own turnaround buffer, added after its end. */
  buffer_minutes: number | null;
  /** Every other queue on the same dock that day (released statuses are filtered here). */
  others: DockDayOther[];
  /** Minutes the queue would hold the dock from `start_time`; drives `overlaps` (omit = not checked). */
  minutes?: number | null;
  open_time?: string | null;
  close_time?: string | null;
  break_start?: string | null;
  break_end?: string | null;
};

/** Response of `GET /api/bookings/[id]/dock-day`, consumed by `DockDayTimeline`. */
export type DockDayResponse = {
  /** null when the queue has no dock yet. */
  dock: { id: string; name: string | null } | null;
  date: string;
  self: { start_time: string; end_time: string | null; buffer_minutes: number | null };
  others: DockDayOther[];
  hours: { open_time: string; close_time: string; break_start: string | null; break_end: string | null } | null;
  /** Server clock in Bangkok local time; the bar draws "now" from this, never from the device. */
  now: { date: string; time: string };
};

/** One dock lane of `GET /api/bookings/[id]/dock-board`. */
export type DockBoardLane = {
  id: string;
  name: string;
  code: string | null;
  /** Live queues on this dock that day, this queue excluded. */
  others: DockDayOther[];
  /** Slot starts (`HH:MM:SS`) `move_dock_booking` would accept on this dock, past ones removed. */
  slotStarts: string[];
};

/** Response of `GET /api/bookings/[id]/dock-board`, consumed by `BookingScheduleDialog`. */
export type DockBoardResponse = {
  date: string;
  self: { booking_date: string; start_time: string; end_time: string | null; service_minutes: number | null; buffer_minutes: number | null; resource_id: string | null };
  /** Docks this queue may use (branch, direction and vehicle type match), in code order. */
  docks: DockBoardLane[];
  hours: { open_time: string; close_time: string; break_start: string | null; break_end: string | null } | null;
  now: { date: string; time: string };
};

/** A block on the bar, in minutes of the day. */
export type DockBlock = { queue: DockDayOther; start: number; end: number; bufferEnd: number };

/** A gap nobody holds, in minutes of the day. */
export type FreeWindow = { start: number; end: number; containsSelf: boolean };

export type DockDay = {
  startMin: number;
  bufferMinutes: number;
  /** Longest stay that fits before the next queue (already net of this queue's buffer); 0 when nothing fits. */
  maxMinutes: number;
  /** Minute of the day this queue must have ended by, or null when nothing follows. */
  mustEndBefore: number | null;
  /** The queue that caps the stay, or null. */
  next: DockDayOther | null;
  /** Other queues as blocks, sorted by start. */
  blocks: DockBlock[];
  /** Blocks this queue would overlap at `start .. start + minutes + buffer` (empty when `minutes` was not given). */
  overlaps: DockBlock[];
  /** Gaps between blocks (break excluded), ignoring this queue itself. */
  freeWindows: FreeWindow[];
  breakRange: { start: number; end: number } | null;
  /** Bar bounds: working hours (or a fallback) widened to cover every block. */
  viewOpen: number;
  viewClose: number;
};

/**
 * `HH:MM` / `HH:MM:SS` → minutes since midnight. Garbage gives NaN, so callers can guard.
 */
export function minutesOfDay(time: string): number {
  const [h, m] = time.split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return Number.NaN;
  return h * 60 + m;
}

/** Minutes since midnight → `HH:MM` (24:00 for the end of the day). */
export function labelOfMinutes(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

function optionalMinutes(time: string | null | undefined): number | null {
  if (!time) return null;
  const m = minutesOfDay(time);
  return Number.isFinite(m) ? m : null;
}

/**
 * Compute the day's picture for one queue. `others` may include the queue itself
 * or released queues; both are ignored.
 */
export function computeDockDay(input: DockDayInput): DockDay {
  const startMin = minutesOfDay(input.start_time);
  const bufferMinutes = Math.max(0, input.buffer_minutes ?? 0);

  const blocks: DockBlock[] = input.others
    .filter((o) => !DOCK_RELEASED_STATUSES.includes(o.status))
    .map((queue) => {
      const start = minutesOfDay(queue.start_time);
      const endRaw = optionalMinutes(queue.end_time);
      const end = endRaw !== null && endRaw > start ? endRaw : start + DEFAULT_OTHER_MINUTES;
      return { queue, start, end, bufferEnd: Math.min(DAY_END, end + Math.max(0, queue.buffer_minutes ?? 0)) };
    })
    .filter((b) => Number.isFinite(b.start))
    .sort((a, b) => a.start - b.start || a.end - b.end);

  // The first queue starting at or after ours caps the stay. Queues that
  // start before ours and run past our start are an existing conflict the
  // guard already refused, so they cannot shorten the stay here.
  const nextBlock = blocks.find((b) => b.start >= startMin) ?? null;
  const hardEnd = nextBlock ? nextBlock.start - bufferMinutes : DAY_END - bufferMinutes;
  const maxMinutes = Math.max(0, Math.min(1440, hardEnd - startMin));
  const mustEndBefore = nextBlock ? nextBlock.start - bufferMinutes : null;

  // Same overlap test as `is_dock_free`, for a start that may sit anywhere in the day (a move).
  const minutes = input.minutes ?? null;
  const overlaps = minutes !== null && Number.isFinite(minutes) && minutes > 0
    ? blocks.filter((b) => b.start < startMin + minutes + bufferMinutes && b.bufferEnd > startMin)
    : [];

  const breakStart = optionalMinutes(input.break_start);
  const breakEnd = optionalMinutes(input.break_end);
  const breakRange = breakStart !== null && breakEnd !== null && breakEnd > breakStart ? { start: breakStart, end: breakEnd } : null;

  const open = optionalMinutes(input.open_time) ?? FALLBACK_OPEN;
  const close = optionalMinutes(input.close_time) ?? FALLBACK_CLOSE;
  let viewOpen = Math.min(open, startMin);
  let viewClose = Math.max(close, startMin + Math.min(maxMinutes, 60));
  for (const b of blocks) {
    viewOpen = Math.min(viewOpen, b.start);
    viewClose = Math.max(viewClose, b.bufferEnd);
  }
  viewOpen = Math.max(0, Math.floor(viewOpen / 60) * 60);
  viewClose = Math.min(DAY_END, Math.ceil(viewClose / 60) * 60);
  if (viewClose - viewOpen < 60) viewClose = Math.min(DAY_END, viewOpen + 60);

  // Free windows: everything between the bar's open and close that no other
  // queue (with its buffer) or the break holds.
  const busy = blocks.map((b) => ({ start: b.start, end: b.bufferEnd }));
  if (breakRange) busy.push({ start: breakRange.start, end: breakRange.end });
  busy.sort((a, b) => a.start - b.start);
  const freeWindows: FreeWindow[] = [];
  let cursor = viewOpen;
  for (const b of busy) {
    if (b.start > cursor) freeWindows.push({ start: cursor, end: b.start, containsSelf: false });
    cursor = Math.max(cursor, b.end);
  }
  if (viewClose > cursor) freeWindows.push({ start: cursor, end: viewClose, containsSelf: false });
  for (const w of freeWindows) w.containsSelf = startMin >= w.start && startMin < w.end;

  return { startMin, bufferMinutes, maxMinutes, mustEndBefore, next: nextBlock?.queue ?? null, blocks, overlaps, freeWindows, breakRange, viewOpen, viewClose };
}

/**
 * The latest slot start at or before a point on the bar — where a dragged
 * queue lands. `move_dock_booking` only accepts real slot starts, so the UI
 * never offers anything else. Null when no slot starts at or before the point.
 */
export function snapToSlot(minuteOfDay: number, slotStarts: readonly number[]): number | null {
  let best: number | null = null;
  for (const s of slotStarts) {
    if (s <= minuteOfDay && (best === null || s > best)) best = s;
  }
  return best;
}
