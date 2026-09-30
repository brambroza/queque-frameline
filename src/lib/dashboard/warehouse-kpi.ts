/**
 * Warehouse KPIs of the dashboard, computed from the timestamps a queue
 * collects on its way through the yard:
 *
 *   start_time (booked) · checked_in_at · called_at · serving_started_at · completed_at
 *
 * Pure: the API route loads the rows and hands them over.
 */

export type WarehouseThresholds = {
  /** Work may start this many minutes after the booked time and still be on time. */
  on_time_tolerance_min: number;
  /** Check-in to close within this many minutes meets the SLA. */
  sla_turnaround_min: number;
  /** Dock time may exceed the plan by this many minutes before it counts as overrun. */
  overrun_tolerance_min: number;
};

export const DEFAULT_THRESHOLDS: WarehouseThresholds = { on_time_tolerance_min: 10, sla_turnaround_min: 60, overrun_tolerance_min: 5 };

export type WarehouseRow = {
  id: string;
  queue_number: string | null;
  booking_date: string;
  start_time: string;
  status: string;
  direction: string | null;
  branch_id: string | null;
  resource_id: string | null;
  service_id: string | null;
  customer_id: string | null;
  service_minutes: number | null;
  checked_in_at: string | null;
  called_at: string | null;
  serving_started_at: string | null;
  completed_at: string | null;
  call_count: number | null;
  plate_number: string | null;
  plate_number_actual: string | null;
  /** `walk_in` = queued at the gate, so the truck cannot be late for its own slot. */
  booking_source?: string | null;
  /** Pending queue on a sales order that is not paid yet. */
  awaiting_payment?: boolean;
};

export type LateCause = 'warehouse' | 'truck';

/** A closed queue with every timestamp present and in order. */
export type TimedQueue = {
  row: WarehouseRow;
  hour: number;
  yard_min: number;
  response_min: number;
  dock_min: number;
  turnaround_min: number;
  late_min: number;
  cause: LateCause | null;
  truck_late: boolean;
  overrun: boolean;
};

export type DockInfo = { id: string; name: string; branch_id: string | null; open_minutes: number };

export type WarehouseCore = {
  closed: number;
  incomplete: number;
  dock_avg: number;
  dock_median: number;
  dock_p90: number;
  plan_avg: number;
  yard_avg: number;
  response_avg: number;
  turnaround_avg: number;
  turnaround_p90: number;
  late: number;
  late_pct: number;
  late_avg_min: number;
  by_warehouse: number;
  by_truck: number;
  overrun: number;
  on_time_pct: number;
  sla_pct: number;
  per_day: number;
  dock_utilization_pct: number;
  no_show_pct: number;
};

export type WarehouseDock = { id: string; name: string; branch_id: string | null; count: number; avg_dock_min: number; avg_wait_min: number; utilization_pct: number };
export type WarehouseVehicle = { service_id: string; plan_min: number; avg_min: number; count: number; overrun: number };
export type WarehouseTrendPoint = { key: string; by_warehouse: number; by_truck: number; closed: number };
export type WarehouseBottleneckRow = { dock_id: string; cells: Array<{ hour: number; avg_wait_min: number | null; count: number }> };
export type WarehouseLateQueue = {
  id: string;
  queue_number: string;
  booking_date: string;
  start_time: string;
  service_id: string | null;
  resource_id: string | null;
  branch_id: string | null;
  cause: LateCause;
  late_min: number;
  turnaround_min: number;
};
export type WarehouseLatePartner = { customer_id: string; trips: number; late: number; pct: number };

const MS_PER_MIN = 60_000;

/** Whole-number percentage, 0 when the denominator is 0. */
export function share(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

/** Linear-interpolated percentile (`p` in 0..1); 0 for an empty list. */
export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const i = (sorted.length - 1) * p;
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
}

/** Booked start of a queue as an instant (site time is Asia/Bangkok, UTC+7, no DST). */
export function bookedStart(bookingDate: string, startTime: string): number {
  return Date.parse(`${bookingDate}T${String(startTime).slice(0, 8).padEnd(8, ':00').slice(0, 8)}+07:00`);
}

/** Plates compare without spaces, dashes or case. */
function normalizePlate(v: string | null): string {
  return (v ?? '').replace(/[\s-]/g, '').toLowerCase();
}

/**
 * Timings of one closed queue, or null when it is not closed or a timestamp is
 * missing or out of order. Such queues are counted as `incomplete`, never guessed.
 */
export function toTimedQueue(row: WarehouseRow, th: WarehouseThresholds): TimedQueue | null {
  if (row.status !== 'completed') return null;
  if (!row.checked_in_at || !row.called_at || !row.serving_started_at || !row.completed_at) return null;
  const start = bookedStart(row.booking_date, row.start_time);
  const checkin = Date.parse(row.checked_in_at);
  const called = Date.parse(row.called_at);
  const serve = Date.parse(row.serving_started_at);
  const done = Date.parse(row.completed_at);
  if (![start, checkin, called, serve, done].every(Number.isFinite)) return null;
  if (checkin > called || called > serve || serve > done) return null;

  const tol = th.on_time_tolerance_min * MS_PER_MIN;
  // A walk-in may be put into a slot that already started: the warehouse is
  // measured from the moment the truck was queued, and the truck is never late.
  const walkIn = row.booking_source === 'walk_in';
  const due = walkIn ? Math.max(start, checkin) : start;
  const late = serve > due + tol;
  const truckLate = !walkIn && checkin > start + tol;
  const dockMin = (done - serve) / MS_PER_MIN;
  return {
    row,
    hour: Number.parseInt(String(row.start_time).slice(0, 2), 10) || 0,
    yard_min: (called - checkin) / MS_PER_MIN,
    response_min: (serve - called) / MS_PER_MIN,
    dock_min: dockMin,
    turnaround_min: (done - checkin) / MS_PER_MIN,
    late_min: Math.max(0, (serve - due) / MS_PER_MIN),
    cause: late ? (truckLate ? 'truck' : 'warehouse') : null,
    truck_late: truckLate,
    overrun: row.service_minutes != null && dockMin > row.service_minutes + th.overrun_tolerance_min,
  };
}

/** Split the rows of a range into timed queues and the count of closed queues that could not be timed. */
export function timeQueues(rows: WarehouseRow[], th: WarehouseThresholds): { timed: TimedQueue[]; incomplete: number } {
  const timed: TimedQueue[] = [];
  let incomplete = 0;
  for (const row of rows) {
    const q = toTimedQueue(row, th);
    if (q) timed.push(q);
    else if (row.status === 'completed') incomplete += 1;
  }
  return { timed, incomplete };
}

/**
 * Headline figures over one set of rows.
 *
 * @param workDays Open days the rows cover (at least 1).
 * @param openMinutes Minutes the docks in view were open over those days.
 */
export function summarizeCore(rows: WarehouseRow[], th: WarehouseThresholds, workDays: number, openMinutes: number): WarehouseCore {
  const { timed, incomplete } = timeQueues(rows, th);
  const dock = timed.map((q) => q.dock_min);
  const turn = timed.map((q) => q.turnaround_min);
  const late = timed.filter((q) => q.cause !== null);
  const planned = timed.filter((q) => q.row.service_minutes != null).map((q) => q.row.service_minutes as number);
  return {
    closed: timed.length,
    incomplete,
    dock_avg: Math.round(average(dock)),
    dock_median: Math.round(percentile(dock, 0.5)),
    dock_p90: Math.round(percentile(dock, 0.9)),
    plan_avg: Math.round(average(planned)),
    yard_avg: Math.round(average(timed.map((q) => q.yard_min))),
    response_avg: Math.round(average(timed.map((q) => q.response_min))),
    turnaround_avg: Math.round(average(turn)),
    turnaround_p90: Math.round(percentile(turn, 0.9)),
    late: late.length,
    late_pct: share(late.length, timed.length),
    late_avg_min: Math.round(average(late.map((q) => q.late_min))),
    by_warehouse: late.filter((q) => q.cause === 'warehouse').length,
    by_truck: late.filter((q) => q.cause === 'truck').length,
    overrun: timed.filter((q) => q.overrun).length,
    on_time_pct: timed.length ? 100 - share(late.length, timed.length) : 0,
    sla_pct: share(timed.filter((q) => q.turnaround_min <= th.sla_turnaround_min).length, timed.length),
    per_day: round1(timed.length / Math.max(1, workDays)),
    dock_utilization_pct: share(dock.reduce((s, m) => s + m, 0), openMinutes),
    no_show_pct: share(rows.filter((r) => r.status === 'no_show').length, rows.length),
  };
}

/** Per dock: trucks served, average dock time, average yard wait, share of open time in use. */
export function summarizeDocks(timed: TimedQueue[], docks: DockInfo[]): WarehouseDock[] {
  return docks.map((d) => {
    const mine = timed.filter((q) => q.row.resource_id === d.id);
    return {
      id: d.id,
      name: d.name,
      branch_id: d.branch_id,
      count: mine.length,
      avg_dock_min: Math.round(average(mine.map((q) => q.dock_min))),
      avg_wait_min: Math.round(average(mine.map((q) => q.yard_min))),
      utilization_pct: share(mine.reduce((s, q) => s + q.dock_min, 0), d.open_minutes),
    };
  });
}

/** Per vehicle type: actual dock time against the planned minutes the queues carried. */
export function summarizeVehicles(timed: TimedQueue[]): WarehouseVehicle[] {
  const groups = new Map<string, TimedQueue[]>();
  for (const q of timed) {
    if (!q.row.service_id) continue;
    groups.set(q.row.service_id, [...(groups.get(q.row.service_id) ?? []), q]);
  }
  return Array.from(groups.entries())
    .map(([service_id, list]) => ({
      service_id,
      plan_min: Math.round(average(list.filter((q) => q.row.service_minutes != null).map((q) => q.row.service_minutes as number))),
      avg_min: Math.round(average(list.map((q) => q.dock_min))),
      count: list.length,
      overrun: list.filter((q) => q.overrun).length,
    }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Late queues per day, or per booked hour when the range is a single day.
 *
 * @param keys Day (ISO) or hour keys in display order; every key gets a point.
 */
export function delayTrend(timed: TimedQueue[], mode: 'day' | 'hour', keys: string[]): WarehouseTrendPoint[] {
  const keyOf = (q: TimedQueue) => (mode === 'day' ? q.row.booking_date : String(q.hour));
  return keys.map((key) => {
    const mine = timed.filter((q) => keyOf(q) === key);
    return {
      key,
      by_warehouse: mine.filter((q) => q.cause === 'warehouse').length,
      by_truck: mine.filter((q) => q.cause === 'truck').length,
      closed: mine.length,
    };
  });
}

/** Average yard wait per dock and booked hour; null where no queue was booked. */
export function bottleneck(timed: TimedQueue[], docks: DockInfo[], hours: number[]): WarehouseBottleneckRow[] {
  return docks.map((d) => ({
    dock_id: d.id,
    cells: hours.map((hour) => {
      const mine = timed.filter((q) => q.row.resource_id === d.id && q.hour === hour);
      return { hour, avg_wait_min: mine.length ? Math.round(average(mine.map((q) => q.yard_min))) : null, count: mine.length };
    }),
  }));
}

/** The queues that started latest against their booking. */
export function latestQueues(timed: TimedQueue[], limit = 10): WarehouseLateQueue[] {
  return timed
    .filter((q): q is TimedQueue & { cause: LateCause } => q.cause !== null)
    .sort((a, b) => b.late_min - a.late_min)
    .slice(0, limit)
    .map((q) => ({
      id: q.row.id,
      queue_number: q.row.queue_number ?? '',
      booking_date: q.row.booking_date,
      start_time: String(q.row.start_time).slice(0, 5),
      service_id: q.row.service_id,
      resource_id: q.row.resource_id,
      branch_id: q.row.branch_id,
      cause: q.cause,
      late_min: Math.round(q.late_min),
      turnaround_min: Math.round(q.turnaround_min),
    }));
}

/**
 * Partners whose trucks check in late most often.
 *
 * @param minTrips Partners with fewer trips are left out so one late trip is not "100%".
 */
export function latePartners(timed: TimedQueue[], minTrips: number, limit = 5): WarehouseLatePartner[] {
  const groups = new Map<string, TimedQueue[]>();
  for (const q of timed) {
    if (!q.row.customer_id) continue;
    groups.set(q.row.customer_id, [...(groups.get(q.row.customer_id) ?? []), q]);
  }
  return Array.from(groups.entries())
    .map(([customer_id, list]) => {
      const late = list.filter((q) => q.truck_late).length;
      return { customer_id, trips: list.length, late, pct: share(late, list.length) };
    })
    .filter((p) => p.trips >= minTrips && p.late > 0)
    .sort((a, b) => b.pct - a.pct || b.late - a.late)
    .slice(0, limit);
}

/** Counts from the dock floor. */
export function floorStats(rows: WarehouseRow[]): { recalled: number; plate_mismatch: number; awaiting_payment: number; inbound: number; outbound: number } {
  return {
    recalled: rows.filter((r) => (r.call_count ?? 0) > 1).length,
    plate_mismatch: rows.filter((r) => r.plate_number_actual && normalizePlate(r.plate_number_actual) !== normalizePlate(r.plate_number)).length,
    awaiting_payment: rows.filter((r) => r.status === 'pending' && r.awaiting_payment).length,
    inbound: rows.filter((r) => r.direction === 'inbound').length,
    outbound: rows.filter((r) => r.direction === 'outbound').length,
  };
}
