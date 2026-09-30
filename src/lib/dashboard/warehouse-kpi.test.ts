import { describe, expect, it } from 'vitest';
import {
  DEFAULT_THRESHOLDS as TH,
  bookedStart,
  bottleneck,
  delayTrend,
  floorStats,
  latePartners,
  latestQueues,
  percentile,
  share,
  summarizeCore,
  summarizeDocks,
  summarizeVehicles,
  timeQueues,
  toTimedQueue,
  type WarehouseRow,
} from './warehouse-kpi';

const DATE = '2026-09-29';

/** Instant `minutes` after 09:00 Bangkok on the test date. */
function at(minutes: number): string {
  return new Date(bookedStart(DATE, '09:00:00') + minutes * 60_000).toISOString();
}

/** A closed queue booked at 09:00: check-in, call, start and close given as minutes from the booking. */
function queue(checkin: number, called: number, serve: number, done: number, over: Partial<WarehouseRow> = {}): WarehouseRow {
  return {
    id: `q${checkin}-${done}`,
    queue_number: 'R-001',
    booking_date: DATE,
    start_time: '09:00:00',
    status: 'completed',
    direction: 'outbound',
    branch_id: 'b1',
    resource_id: 'd1',
    service_id: 's1',
    customer_id: 'c1',
    service_minutes: 30,
    checked_in_at: at(checkin),
    called_at: at(called),
    serving_started_at: at(serve),
    completed_at: at(done),
    call_count: 1,
    plate_number: '70-1234',
    plate_number_actual: null,
    ...over,
  };
}

describe('bookedStart', () => {
  it('reads the booking in Bangkok time', () => {
    expect(new Date(bookedStart(DATE, '09:00:00')).toISOString()).toBe('2026-09-29T02:00:00.000Z');
    expect(bookedStart(DATE, '09:00')).toBe(bookedStart(DATE, '09:00:00'));
  });
});

describe('toTimedQueue', () => {
  it('splits the visit into yard, response and dock time', () => {
    const q = toTimedQueue(queue(-10, 0, 4, 34), TH)!;
    expect(q.yard_min).toBe(10);
    expect(q.response_min).toBe(4);
    expect(q.dock_min).toBe(30);
    expect(q.turnaround_min).toBe(44);
    expect(q.cause).toBeNull();
    expect(q.overrun).toBe(false);
  });

  it('keeps a start inside the tolerance on time', () => {
    expect(toTimedQueue(queue(-5, 5, 10, 40), TH)!.cause).toBeNull();
    expect(toTimedQueue(queue(-5, 5, 11, 41), TH)!.cause).toBe('warehouse');
  });

  it('blames the truck when it checked in late', () => {
    const q = toTimedQueue(queue(20, 22, 25, 55), TH)!;
    expect(q.cause).toBe('truck');
    expect(q.truck_late).toBe(true);
    expect(q.late_min).toBe(25);
  });

  it('blames the warehouse when the truck was on time', () => {
    const q = toTimedQueue(queue(-15, 25, 30, 60), TH)!;
    expect(q.cause).toBe('warehouse');
    expect(q.truck_late).toBe(false);
  });

  it('never blames a walk-in truck for a slot that had already started', () => {
    // Queued at 09:12 into the 09:00 slot, work starts 09:20: on time, measured from the check-in.
    const onTime = toTimedQueue(queue(12, 15, 20, 50, { booking_source: 'walk_in' }), TH)!;
    expect(onTime.cause).toBeNull();
    expect(onTime.truck_late).toBe(false);
    expect(onTime.late_min).toBe(8);
    // Same truck left waiting 30 minutes after check-in: that one is on the warehouse.
    const slow = toTimedQueue(queue(12, 40, 42, 72, { booking_source: 'walk_in' }), TH)!;
    expect(slow.cause).toBe('warehouse');
    expect(slow.truck_late).toBe(false);
    expect(slow.late_min).toBe(30);
    // The same timestamps on a booked queue stay the truck's fault.
    expect(toTimedQueue(queue(12, 15, 25, 55, { booking_source: 'admin' }), TH)!.cause).toBe('truck');
  });

  it('measures a walk-in that took a later slot from that slot', () => {
    // Checked in 08:40 for the 09:00 slot.
    expect(toTimedQueue(queue(-20, 0, 5, 35, { booking_source: 'walk_in' }), TH)!.cause).toBeNull();
    const q = toTimedQueue(queue(-20, 10, 15, 45, { booking_source: 'walk_in' }), TH)!;
    expect(q.cause).toBe('warehouse');
    expect(q.late_min).toBe(15);
  });

  it('flags dock time beyond plan plus tolerance', () => {
    expect(toTimedQueue(queue(-5, 0, 2, 37), TH)!.overrun).toBe(false);
    expect(toTimedQueue(queue(-5, 0, 2, 38), TH)!.overrun).toBe(true);
    expect(toTimedQueue(queue(-5, 0, 2, 90, { service_minutes: null }), TH)!.overrun).toBe(false);
  });

  it('refuses queues that are open, incomplete or out of order', () => {
    expect(toTimedQueue(queue(-5, 0, 2, 30, { status: 'serving' }), TH)).toBeNull();
    expect(toTimedQueue(queue(-5, 0, 2, 30, { called_at: null }), TH)).toBeNull();
    expect(toTimedQueue(queue(-5, 0, 2, 30, { completed_at: 'x' }), TH)).toBeNull();
    expect(toTimedQueue(queue(5, 0, 2, 30), TH)).toBeNull();
    expect(toTimedQueue(queue(-5, 0, 40, 30), TH)).toBeNull();
  });
});

describe('timeQueues', () => {
  it('counts closed queues it could not time, and ignores the rest', () => {
    const rows = [queue(-5, 0, 2, 30), queue(-5, 0, 2, 30, { checked_in_at: null }), queue(-5, 0, 2, 30, { status: 'cancelled' })];
    const out = timeQueues(rows, TH);
    expect(out.timed).toHaveLength(1);
    expect(out.incomplete).toBe(1);
  });
});

describe('summarizeCore', () => {
  const rows = [
    queue(-10, 0, 4, 34), // on time, 30 on the dock
    queue(-10, 20, 25, 65), // warehouse late, 40 on the dock (overrun)
    queue(30, 32, 35, 55), // truck late, 20 on the dock
    queue(0, 0, 0, 0, { status: 'no_show', checked_in_at: null, called_at: null, serving_started_at: null, completed_at: null }),
  ];
  const core = summarizeCore(rows, TH, 1, 480);

  it('averages the dock time of closed queues', () => {
    expect(core.closed).toBe(3);
    expect(core.dock_avg).toBe(30);
    expect(core.dock_median).toBe(30);
    expect(core.plan_avg).toBe(30);
  });

  it('splits late queues by cause', () => {
    expect(core.late).toBe(2);
    expect(core.by_warehouse).toBe(1);
    expect(core.by_truck).toBe(1);
    expect(core.by_warehouse + core.by_truck).toBe(core.late);
    expect(core.late_pct).toBe(67);
    expect(core.on_time_pct).toBe(33);
    expect(core.overrun).toBe(1);
  });

  it('measures SLA, throughput, dock use and no-shows', () => {
    expect(core.sla_pct).toBe(67);
    expect(core.per_day).toBe(3);
    expect(core.dock_utilization_pct).toBe(19);
    expect(core.no_show_pct).toBe(25);
  });

  it('adds the three legs up to the turnaround', () => {
    const { timed } = timeQueues(rows, TH);
    for (const q of timed) expect(q.yard_min + q.response_min + q.dock_min).toBeCloseTo(q.turnaround_min);
  });

  it('returns zeros for an empty range', () => {
    const empty = summarizeCore([], TH, 0, 0);
    expect(empty.closed).toBe(0);
    expect(empty.dock_avg).toBe(0);
    expect(empty.on_time_pct).toBe(0);
    expect(empty.per_day).toBe(0);
    expect(empty.dock_utilization_pct).toBe(0);
  });
});

describe('breakdowns', () => {
  const rows = [
    queue(-10, 0, 4, 34),
    queue(-10, 20, 25, 65, { id: 'late-wh', resource_id: 'd2', service_id: 's2', service_minutes: 30, customer_id: 'c2' }),
    queue(30, 32, 35, 55, { id: 'late-truck', customer_id: 'c2', start_time: '10:00:00', checked_in_at: at(90), called_at: at(92), serving_started_at: at(95), completed_at: at(115) }),
  ];
  const { timed } = timeQueues(rows, TH);
  const docks = [
    { id: 'd1', name: 'ท่า 1', branch_id: 'b1', open_minutes: 480 },
    { id: 'd2', name: 'ท่า 2', branch_id: 'b1', open_minutes: 480 },
    { id: 'd3', name: 'ท่า 3', branch_id: 'b1', open_minutes: 0 },
  ];

  it('summarizes each dock, idle ones included', () => {
    const out = summarizeDocks(timed, docks);
    expect(out.map((d) => d.count)).toEqual([2, 1, 0]);
    expect(out[0].avg_dock_min).toBe(25);
    expect(out[0].utilization_pct).toBe(10);
    expect(out[2].utilization_pct).toBe(0);
  });

  it('compares vehicle types with their plan', () => {
    const out = summarizeVehicles(timed);
    expect(out.find((v) => v.service_id === 's2')).toEqual({ service_id: 's2', plan_min: 30, avg_min: 40, count: 1, overrun: 1 });
  });

  it('buckets late queues by day and by hour', () => {
    expect(delayTrend(timed, 'day', ['2026-09-28', DATE])).toEqual([
      { key: '2026-09-28', by_warehouse: 0, by_truck: 0, closed: 0 },
      { key: DATE, by_warehouse: 1, by_truck: 1, closed: 3 },
    ]);
    expect(delayTrend(timed, 'hour', ['9', '10']).map((p) => p.closed)).toEqual([2, 1]);
  });

  it('maps yard wait per dock and hour', () => {
    const out = bottleneck(timed, docks.slice(0, 2), [9, 10]);
    expect(out[0].cells).toEqual([{ hour: 9, avg_wait_min: 10, count: 1 }, { hour: 10, avg_wait_min: 2, count: 1 }]);
    expect(out[1].cells[1]).toEqual({ hour: 10, avg_wait_min: null, count: 0 });
  });

  it('ranks the latest queues', () => {
    const out = latestQueues(timed);
    expect(out.map((q) => q.id)).toEqual(['late-truck', 'late-wh']);
    expect(out[0]).toMatchObject({ cause: 'truck', late_min: 35, start_time: '10:00' });
    expect(latestQueues(timed, 1)).toHaveLength(1);
  });

  it('ranks partners by late check-ins and drops thin samples', () => {
    expect(latePartners(timed, 1)).toEqual([{ customer_id: 'c2', trips: 2, late: 1, pct: 50 }]);
    expect(latePartners(timed, 3)).toEqual([]);
  });
});

describe('floorStats', () => {
  it('counts recalls, plate mismatches, unpaid pending queues and directions', () => {
    const rows = [
      queue(-5, 0, 2, 30, { call_count: 2 }),
      queue(-5, 0, 2, 30, { plate_number_actual: '70 1234' }),
      queue(-5, 0, 2, 30, { plate_number_actual: '80-9999', direction: 'inbound' }),
      queue(-5, 0, 2, 30, { status: 'pending', awaiting_payment: true }),
      queue(-5, 0, 2, 30, { status: 'confirmed', awaiting_payment: true }),
    ];
    expect(floorStats(rows)).toEqual({ recalled: 1, plate_mismatch: 1, awaiting_payment: 1, inbound: 1, outbound: 4 });
  });
});

describe('helpers', () => {
  it('interpolates percentiles', () => {
    expect(percentile([10, 20, 30, 40], 0.5)).toBe(25);
    expect(percentile([10], 0.9)).toBe(10);
    expect(percentile([], 0.5)).toBe(0);
  });

  it('guards the percentage against a zero denominator', () => {
    expect(share(1, 0)).toBe(0);
    expect(share(1, 3)).toBe(33);
  });
});
