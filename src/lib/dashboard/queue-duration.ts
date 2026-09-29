/**
 * How long one queue took, counted from the moment it was called to the dock
 * until the job was closed (`called_at` → `completed_at`).
 */

export type QueueDurationInput = {
  status: string;
  called_at: string | null | undefined;
  completed_at: string | null | undefined;
};

export type QueueDuration =
  /** Closed: the final figure. */
  | { kind: 'done'; minutes: number }
  /** Called or being served: minutes so far. */
  | { kind: 'running'; minutes: number }
  /** Never called, or the timestamps cannot be trusted. */
  | { kind: 'none' };

/** Statuses during which the clock is still running. */
const RUNNING_STATUSES = ['called', 'serving'];

/** Whole minutes between two instants, or null when either is unreadable or the order is wrong. */
function minutesBetween(from: string, to: string | number): number | null {
  const a = Date.parse(from);
  const b = typeof to === 'number' ? to : Date.parse(to);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return null;
  return Math.round((b - a) / 60000);
}

/**
 * Duration of a queue from call to close.
 *
 * - `completed` with both timestamps → the final minutes.
 * - `called` / `serving` → minutes elapsed up to `now`.
 * - anything else (not called yet, cancelled, no-show, call undone) → none.
 *
 * A re-call stamps `called_at` again (see `buildStatusPatch`), so for a queue
 * called more than once the figure starts at the latest call.
 *
 * @param now Current time in epoch milliseconds, for queues still running.
 */
export function queueDuration(b: QueueDurationInput, now: number): QueueDuration {
  if (!b.called_at) return { kind: 'none' };
  if (b.status === 'completed') {
    const minutes = b.completed_at ? minutesBetween(b.called_at, b.completed_at) : null;
    return minutes === null ? { kind: 'none' } : { kind: 'done', minutes };
  }
  if (RUNNING_STATUSES.includes(b.status)) {
    const minutes = minutesBetween(b.called_at, now);
    return minutes === null ? { kind: 'none' } : { kind: 'running', minutes };
  }
  return { kind: 'none' };
}

/** Final minutes of a closed queue, or null. For exports and averages. */
export function closedMinutes(b: QueueDurationInput): number | null {
  const d = queueDuration(b, 0);
  return d.kind === 'done' ? d.minutes : null;
}

/** Average of the closed queues in the list (rounded), or null when none is closed. */
export function averageClosedMinutes(rows: QueueDurationInput[]): number | null {
  const done = rows.map(closedMinutes).filter((m): m is number => m !== null);
  if (done.length === 0) return null;
  return Math.round(done.reduce((s, m) => s + m, 0) / done.length);
}

/** "45 นาที" below an hour, "1 ชม. 5 นาที" from there on. */
export function formatMinutes(minutes: number, unit: { minute: string; hour: string }): string {
  if (minutes < 60) return `${minutes} ${unit.minute}`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} ${unit.hour}` : `${h} ${unit.hour} ${m} ${unit.minute}`;
}
