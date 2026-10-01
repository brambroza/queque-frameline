/**
 * "Has this slot already started?" — shared by the public slots list (to grey
 * a slot out) and the public book endpoint (to refuse it), so the LIFF grid
 * and the server never disagree.
 *
 * Booking dates and times are Bangkok-local strings with no zone, so the
 * comparison is done on Bangkok-local strings too (see `toBangkokStamp`).
 * The device clock is never trusted: both callers pass a server-side `now`.
 */
/** A point in Bangkok local time as the strings the DB stores (`booking_date` / `start_time`). */
export type LocalStamp = { date: string; time: string };

/** Machine-readable code on the 400 from `/book`, so the LIFF can reload the grid. */
export const SLOT_PAST_CODE = 'slot_past';

/** Customer-facing message when the chosen slot has already started. */
export const SLOT_PAST_MESSAGE = 'ช่วงเวลานี้ผ่านไปแล้ว กรุณาเลือกเวลาใหม่';

/** Hint when every slot of the selected day has already started. */
export const DAY_OVER_HINT = 'หมดเวลาจองสำหรับวันนี้แล้ว';

/** Hint when the selected date is before today. */
export const DATE_PAST_HINT = 'วันที่เลือกผ่านไปแล้ว กรุณาเลือกวันใหม่';

/**
 * Normalise `HH:MM` / `HH:MM:SS` to `HH:MM:SS` so string comparison is safe.
 *
 * @param time - Time string from the client or the DB.
 * @returns Eight-character `HH:MM:SS`.
 */
export function normalizeSlotTime(time: string): string {
  const trimmed = time.trim();
  if (/^\d{2}:\d{2}$/.test(trimmed)) return `${trimmed}:00`;
  return trimmed.slice(0, 8);
}

/**
 * A slot is past once its start time is strictly before `now` in Bangkok
 * local time. A slot starting exactly now is still bookable. Any date before
 * today is past regardless of time.
 *
 * @param slot - Booking date `YYYY-MM-DD` and start time `HH:MM[:SS]`.
 * @param now - Server-side Bangkok stamp from `toBangkokStamp`.
 * @returns `true` when the slot has already started.
 */
export function isSlotPast(slot: { date: string; time: string }, now: LocalStamp): boolean {
  if (slot.date < now.date) return true;
  if (slot.date > now.date) return false;
  return normalizeSlotTime(slot.time) < normalizeSlotTime(now.time);
}

/**
 * Convert an instant to Bangkok-local `YYYY-MM-DD` + `HH:MM:SS`, matching how
 * `booking_date` / `start_time` are stored.
 *
 * @param at Instant to convert (server clock).
 */
export function toBangkokStamp(at: Date): LocalStamp {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(at);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00';
  return { date: `${get('year')}-${get('month')}-${get('day')}`, time: `${get('hour')}:${get('minute')}:${get('second')}` };
}

/** Add days to an ISO date (UTC arithmetic, no DST surprises). */
export function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export type SlotRow = {
  slot_time: string;
  slot_end: string;
  capacity: number;
  booked_count: number;
  remaining_capacity: number;
  /** `get_dock_slots(p_overflow => true)`: the service would end after closing time. */
  overflow?: boolean | null;
};
export type SlotView = SlotRow & { is_past: boolean; too_soon: boolean; bookable: boolean };

/**
 * Decorate RPC slots for a UI: past, inside the minimum lead time, bookable.
 *
 * @param date Day the slots belong to.
 * @param rows Output of `get_dock_slots`.
 * @param now Server clock.
 * @param leadHours Minimum notice customers must give (0 for staff).
 */
export function decorateSlots(date: string, rows: SlotRow[], now: Date, leadHours: number): SlotView[] {
  const stamp = toBangkokStamp(now);
  const earliest = now.getTime() + Math.max(leadHours, 0) * 3_600_000;
  return rows.map((r) => {
    const isPast = isSlotPast({ date, time: r.slot_time }, stamp);
    const startMs = new Date(`${date}T${normalizeSlotTime(r.slot_time)}+07:00`).getTime();
    const tooSoon = !isPast && startMs < earliest;
    return { ...r, is_past: isPast, too_soon: tooSoon, bookable: !isPast && !tooSoon && r.remaining_capacity > 0 };
  });
}

export type WalkInSlotView = SlotView & { in_progress: boolean; overflow: boolean };

/**
 * Decorate RPC slots for a walk-in: a truck already on site may also take the
 * slot that is running right now, as long as a dock is still free for it.
 *
 * Only the latest slot that has started counts as "running". When the vehicle
 * type's duration is longer than the slot interval several slots overlap the
 * clock, and an older one would leave the truck almost no time before the next
 * queue on that dock. Walk-ins are for today only: any other `date` yields no
 * bookable slot.
 *
 * @param date Day the slots belong to.
 * @param rows Output of `get_dock_slots`.
 * @param now Server clock.
 */
export function decorateWalkInSlots(date: string, rows: SlotRow[], now: Date): WalkInSlotView[] {
  const stamp = toBangkokStamp(now);
  const nowTime = normalizeSlotTime(stamp.time);
  const isToday = date === stamp.date;
  const started = (r: SlotRow) => isSlotPast({ date, time: r.slot_time }, stamp);
  const runningStart = isToday
    ? rows.filter(started).reduce<string | null>((latest, r) => {
        const t = normalizeSlotTime(r.slot_time);
        return latest === null || t > latest ? t : latest;
      }, null)
    : null;
  return rows.map((r) => {
    const hasStarted = started(r);
    const inProgress = isToday && hasStarted && normalizeSlotTime(r.slot_time) === runningStart && normalizeSlotTime(r.slot_end) > nowTime;
    const isPast = hasStarted && !inProgress;
    return { ...r, is_past: isPast, too_soon: false, in_progress: inProgress, overflow: Boolean(r.overflow), bookable: isToday && !isPast && r.remaining_capacity > 0 };
  });
}

export type WalkInSummary = {
  /** Slots inside working hours that can still be taken. */
  regular: WalkInSlotView[];
  /** Slots after the last queue / closing time that can be taken. */
  overflow: WalkInSlotView[];
  /** Working hours are used up: the truck can only queue after the last booking. */
  full: boolean;
  /** Earliest slot the truck can take, regular hours first. */
  next: WalkInSlotView | null;
};

/**
 * What the walk-in grid tells the user: is anything left inside working hours,
 * and if not, where the queue continues.
 *
 * @param slots Output of `decorateWalkInSlots`.
 */
export function summarizeWalkInSlots(slots: WalkInSlotView[]): WalkInSummary {
  const bookable = slots.filter((s) => s.bookable);
  const regular = bookable.filter((s) => !s.overflow);
  const overflow = bookable.filter((s) => s.overflow);
  return { regular, overflow, full: regular.length === 0, next: regular[0] ?? overflow[0] ?? null };
}

/**
 * Slots the walk-in grid shows: every regular slot that has not finished
 * (free or full, so the user sees the day at a glance) and, only when working
 * hours are used up, the first few free overflow slots to queue after the
 * last booking.
 *
 * @param slots Output of `decorateWalkInSlots`.
 * @param overflowLimit How many "queue after" choices to offer.
 */
export function visibleWalkInSlots(slots: WalkInSlotView[], overflowLimit = 3): WalkInSlotView[] {
  const summary = summarizeWalkInSlots(slots);
  const regular = slots.filter((s) => !s.overflow && !s.is_past);
  return summary.full ? [...regular, ...summary.overflow.slice(0, Math.max(overflowLimit, 0))] : regular;
}

/** A live booking of today, as read for the "last queue" line of the walk-in grid. */
export type LiveQueueRow = {
  queue_number: string | null;
  start_time: string;
  end_time: string | null;
  buffer_minutes: number | null;
  resource_id: string | null;
  resource_name: string | null;
  direction: string;
};

export type LastQueue = {
  queue_number: string;
  start_time: string;
  end_time: string;
  /** When its dock is free again: end + turnaround buffer. */
  free_from: string;
  resource_name: string | null;
};

/** `HH:MM:SS` plus minutes, clamped to the same day. */
export function addMinutesToTime(time: string, minutes: number): string {
  const [h, m, s] = normalizeSlotTime(time).split(':').map(Number);
  const total = Math.min(Math.max(h * 60 + m + minutes, 0), 23 * 60 + 59);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}:${String(s || 0).padStart(2, '0')}`;
}

/**
 * The booking that blocks an eligible dock the longest today — the "last
 * queue" a walk-in would wait behind. Dock-less live bookings of the same
 * direction count too (they will take one of these docks).
 *
 * @param rows Live bookings of today (`LIVE_STATUSES`).
 * @param dockIds Docks this vehicle type / direction may use.
 * @param direction Direction of the walk-in.
 */
export function pickLastQueue(rows: LiveQueueRow[], dockIds: readonly string[], direction: string): LastQueue | null {
  let best: LastQueue | null = null;
  for (const r of rows) {
    const onDock = r.resource_id ? dockIds.includes(r.resource_id) : r.direction === direction;
    if (!onDock) continue;
    const end = r.end_time ? normalizeSlotTime(r.end_time) : addMinutesToTime(r.start_time, 30);
    const freeFrom = addMinutesToTime(end, Math.max(r.buffer_minutes ?? 0, 0));
    if (!best || freeFrom > best.free_from) {
      best = { queue_number: r.queue_number ?? '-', start_time: normalizeSlotTime(r.start_time), end_time: end, free_from: freeFrom, resource_name: r.resource_name };
    }
  }
  return best;
}

/**
 * Why a walk-in may not take the slot starting at `time`, or null when it may.
 * The grid and `POST /api/bookings` both go through `decorateWalkInSlots`, so
 * they cannot disagree.
 *
 * @param slots Output of `decorateWalkInSlots`.
 * @param time Requested start `HH:MM[:SS]`.
 */
export function walkInSlotProblem(slots: WalkInSlotView[], time: string): typeof SLOT_PAST_CODE | 'slot_unavailable' | null {
  const slot = slots.find((s) => normalizeSlotTime(s.slot_time) === normalizeSlotTime(time));
  if (!slot) return 'slot_unavailable';
  if (slot.bookable) return null;
  return slot.is_past ? SLOT_PAST_CODE : 'slot_unavailable';
}
