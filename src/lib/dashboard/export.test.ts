import { describe, expect, it } from 'vitest';
import type { DashboardData } from '@/types/dashboard';
import { buildDashboardSheets, csvField, dashboardFileStem, fileSafe, guardFormula, safeSheetName, sheetToCsv, type DashboardExportBooking } from './export';

const t = (_key: string, fallback?: string) => fallback ?? _key;
const statusLabel = (s: string) => `S:${s}`;

type ExportData = Omit<DashboardData, 'warehouse'> & { warehouse?: DashboardData['warehouse'] };

function makeData(overrides: Partial<ExportData> = {}): ExportData {
  return {
    range: { kind: 'week', from: '2026-09-21', to: '2026-09-27', prev_from: '2026-09-14', prev_to: '2026-09-20', days: 7, today: '2026-09-24' },
    kpi: {
      total: 12,
      booked: 10,
      completed: 6,
      cancelled: 1,
      no_show: 1,
      serving: 1,
      waiting: 2,
      capacity: 40,
      utilization_pct: 25,
      customers_new: 3,
      customers_returning: 4,
      avg_queue_minutes: 41,
      closed_queues: 6,
      prev: { total: 8, booked: 7, completed: 5, cancelled: 1, no_show: 0, utilization_pct: 18, avg_queue_minutes: 46 },
    },
    by_day: [
      { date: '2026-09-21', count: 4, capacity: 8, is_holiday: false },
      { date: '2026-09-27', count: 0, capacity: 0, is_holiday: true },
    ],
    by_hour: [],
    heatmap: {
      mode: 'date',
      hours: [8, 9],
      rows: [{ key: '2026-09-21', cells: [{ hour: 8, count: 3, capacity: 4 }, { hour: 9, count: 1, capacity: 4 }] }],
    },
    weekday_pattern: [
      { weekday: 0, avg_count: 0, avg_utilization_pct: 0, weeks: 0 },
      { weekday: 1, avg_count: 5.5, avg_utilization_pct: 60, weeks: 8 },
    ],
    by_status: [
      { status: 'confirmed', count: 3 },
      { status: 'completed', count: 1 },
    ],
    insights: [],
    recent_bookings: { rows: [], total: 0, page: 1, limit: 10 },
    popular_services: [{ name: '6 ล้อ', count: 5, pct: 50 }],
    branch_summary: [{ name: 'คลังหลัก', count: 10, pct: 25 }],
    branch_kpi: [{ branch_id: 'b1', name: 'คลังหลัก', total: 12, booked: 10, completed: 6, cancelled: 1, no_show: 1, capacity: 40, utilization_pct: 25 }],
    shop_meta: { demo_mode_enabled: false, demo_business_type: null, line_setup_completed: false, shop_key: 'fameline' },
    ...overrides,
  };
}

const booking: DashboardExportBooking = {
  booking_date: '2026-09-21',
  start_time: '09:00',
  queue_number: 'R-001',
  direction: 'outbound',
  customer_name: '=HYPERLINK("http://x")',
  service_name: '6 ล้อ',
  branch_name: 'คลังหลัก',
  resource_name: 'ท่า 1',
  plate_number: '70-1234',
  do_number: 'DO-202609-0001',
  status: 'confirmed',
  created_at: '20/09/2026 10:00',
  called_at: '21/09/2026 09:02',
  completed_at: '21/09/2026 09:49',
  call_count: 2,
  queue_minutes: 47,
};

describe('buildDashboardSheets', () => {
  const sheets = buildDashboardSheets({ data: makeData(), bookings: [booking], t, statusLabel });
  const byKey = (key: string) => sheets.find((s) => s.key === key)!;

  it('returns every sheet in page order', () => {
    expect(sheets.map((s) => s.key)).toEqual(['summary', 'daily', 'hourly', 'status', 'services', 'branches', 'weekday', 'bookings']);
  });

  it('keeps every row as wide as its header', () => {
    for (const s of sheets) for (const r of s.rows) expect(r).toHaveLength(s.header.length);
  });

  it('puts the current and previous KPI side by side', () => {
    expect(byKey('summary').rows).toContainEqual(['คิวทั้งหมด', 10, 7]);
    expect(byKey('summary').rows).toContainEqual(['จากวันที่', '2026-09-21', '2026-09-14']);
  });

  it('computes daily utilization and survives zero capacity', () => {
    expect(byKey('daily').rows[0]).toEqual(['2026-09-21', 'จันทร์', 4, 8, 50, '']);
    expect(byKey('daily').rows[1]).toEqual(['2026-09-27', 'อาทิตย์', 0, 0, 0, 'ใช่']);
  });

  it('lays the heatmap out as one column per hour', () => {
    expect(byKey('hourly').header).toEqual(['วันที่', '08:00', '09:00']);
    expect(byKey('hourly').rows).toEqual([['2026-09-21', 3, 1]]);
  });

  it('names weekday rows when the heatmap is collapsed', () => {
    const collapsed = buildDashboardSheets({
      data: makeData({ heatmap: { mode: 'weekday', hours: [8], rows: [{ key: '1', cells: [{ hour: 8, count: 2.5, capacity: 4 }] }] } }),
      bookings: [],
      t,
      statusLabel,
    });
    expect(collapsed.find((s) => s.key === 'hourly')!.rows).toEqual([['จันทร์', 2.5]]);
  });

  it('labels statuses and shares', () => {
    expect(byKey('status').rows).toEqual([['S:confirmed', 3, 75], ['S:completed', 1, 25]]);
  });

  it('compares branches on the full KPI set', () => {
    expect(byKey('branches').header).toHaveLength(8);
    expect(byKey('branches').rows).toEqual([['คลังหลัก', 12, 10, 6, 1, 1, 40, 25]]);
  });

  it('falls back to the count summary without branch KPI', () => {
    const old = buildDashboardSheets({ data: { ...makeData(), branch_kpi: [] }, bookings: [], t, statusLabel });
    expect(old.find((s) => s.key === 'branches')!.rows).toEqual([['คลังหลัก', 10, 25]]);
  });

  it('orders the weekday pattern Monday first', () => {
    expect(byKey('weekday').rows.map((r) => r[0])).toEqual(['จันทร์', 'อาทิตย์']);
  });

  it('maps booking rows with translated direction and status', () => {
    const row = byKey('bookings').rows[0];
    expect(row[3]).toBe('ขาออก (SO)');
    expect(row[10]).toBe('S:confirmed');
  });

  it('exports call-to-close minutes per queue and the range average', () => {
    expect(byKey('bookings').rows[0].slice(12)).toEqual(['21/09/2026 09:02', '21/09/2026 09:49', 47, 2]);
    expect(byKey('summary').rows).toContainEqual(['เวลาเฉลี่ยต่อคิว เรียก→ปิดงาน (นาที)', 41, 46]);
  });

  it('leaves the minutes blank for a queue that is not closed', () => {
    const open = buildDashboardSheets({ data: makeData(), bookings: [{ ...booking, called_at: '', completed_at: '', call_count: 0, queue_minutes: null }], t, statusLabel });
    expect(open.find((s) => s.key === 'bookings')!.rows[0].slice(12)).toEqual(['', '', '', 0]);
  });

  it('returns header-only sheets for an empty range', () => {
    const empty = buildDashboardSheets({ data: makeData({ by_day: [], by_status: [], popular_services: [], branch_summary: [], branch_kpi: [] }), bookings: [], t, statusLabel });
    expect(empty.find((s) => s.key === 'bookings')!.rows).toEqual([]);
    expect(empty.find((s) => s.key === 'status')!.rows).toEqual([]);
  });
});

describe('warehouse sheets', () => {
  const prev = { dock_avg: 40, late: 5, on_time_pct: 70, turnaround_avg: 55, sla_pct: 68, per_day: 28, dock_utilization_pct: 50, no_show_pct: 4 };
  const warehouse: DashboardData['warehouse'] = {
    available: true,
    thresholds: { on_time_tolerance_min: 10, sla_turnaround_min: 60, overrun_tolerance_min: 5 },
    kpi: {
      closed: 20, incomplete: 1, dock_avg: 36, dock_median: 32, dock_p90: 60, plan_avg: 32, yard_avg: 9, response_avg: 5, turnaround_avg: 50, turnaround_p90: 80,
      late: 6, late_pct: 30, late_avg_min: 22, by_warehouse: 4, by_truck: 2, overrun: 7, on_time_pct: 70, sla_pct: 75, per_day: 20, dock_utilization_pct: 55, no_show_pct: 4, per_dock_hour: 0.8, prev,
    },
    trend: { mode: 'day', points: [] },
    docks: [{ id: 'd1', name: 'ท่า 1', branch_id: 'b1', branch_name: 'คลังหลัก', count: 12, avg_dock_min: 35, avg_wait_min: 8, utilization_pct: 60 }],
    vehicles: [{ service_id: 's1', name: '10 ล้อ', plan_min: 45, avg_min: 52, count: 8, overrun: 5 }],
    bottleneck: { hours: [], rows: [] },
    late_queues: [{ id: 'q1', queue_number: 'R-004', booking_date: '2026-09-21', start_time: '14:00', service_id: 's1', resource_id: 'd1', branch_id: 'b1', cause: 'truck', late_min: 56, turnaround_min: 64, service_name: '10 ล้อ', dock_name: 'ท่า 1', branch_name: 'คลังหลัก' }],
    late_partners: [],
    branches: [],
    floor: { recalled: 1, plate_mismatch: 0, awaiting_payment: 2, inbound: 5, outbound: 15 },
  };
  const sheets = buildDashboardSheets({ data: makeData({ warehouse }), bookings: [], t, statusLabel });
  const byKey = (key: string) => sheets.find((s) => s.key === key)!;

  it('follows the summary', () => {
    expect(sheets.map((s) => s.key).slice(0, 5)).toEqual(['summary', 'warehouse', 'docks', 'vehicles', 'late']);
    for (const s of sheets) for (const r of s.rows) expect(r).toHaveLength(s.header.length);
  });

  it('carries the headline figures with the previous period and the thresholds used', () => {
    expect(byKey('warehouse').rows).toContainEqual(['เวลาที่ท่า เฉลี่ย (นาที)', 36, 40]);
    expect(byKey('warehouse').rows).toContainEqual(['คิวล่าช้า', 6, 5]);
    expect(byKey('warehouse').rows).toContainEqual(['เกณฑ์: เป้า SLA (นาที)', 60, '']);
  });

  it('lists docks, vehicle types and late queues', () => {
    expect(byKey('docks').rows).toEqual([['คลังหลัก', 'ท่า 1', 12, 35, 8, 60]]);
    expect(byKey('vehicles').rows).toEqual([['10 ล้อ', 8, 52, 45, 5]]);
    expect(byKey('late').rows).toEqual([['R-004', '2026-09-21', '14:00', '10 ล้อ', 'คลังหลัก', 'ท่า 1', 'รถมาสาย', 56, 64]]);
  });
});

describe('guardFormula', () => {
  it('prefixes text a spreadsheet would evaluate', () => {
    expect(guardFormula('=1+1')).toBe("'=1+1");
    expect(guardFormula('+66812345678')).toBe("'+66812345678");
    expect(guardFormula('-cmd')).toBe("'-cmd");
    expect(guardFormula('@SUM(A1)')).toBe("'@SUM(A1)");
  });

  it('leaves ordinary text alone', () => {
    expect(guardFormula('R-001')).toBe('R-001');
    expect(guardFormula('บริษัท ก')).toBe('บริษัท ก');
    expect(guardFormula('')).toBe('');
  });
});

describe('csvField', () => {
  it('writes numbers unquoted, including negatives', () => {
    expect(csvField(12)).toBe('12');
    expect(csvField(-3.5)).toBe('-3.5');
    expect(csvField(Number.NaN)).toBe('');
  });

  it('quotes commas, quotes and line breaks', () => {
    expect(csvField('a,b')).toBe('"a,b"');
    expect(csvField('say "hi"')).toBe('"say ""hi"""');
    expect(csvField('line1\nline2')).toBe('"line1\nline2"');
  });

  it('guards and quotes a formula payload', () => {
    expect(csvField('=HYPERLINK("http://x")')).toBe('"\'=HYPERLINK(""http://x"")"');
  });
});

describe('sheetToCsv', () => {
  it('starts with a BOM and uses CRLF rows', () => {
    const csv = sheetToCsv({ key: 'status', name: 'x', header: ['สถานะ', 'จำนวน'], rows: [['ยืนยันแล้ว', 3]] });
    expect(csv).toBe('﻿สถานะ,จำนวน\r\nยืนยันแล้ว,3\r\n');
  });
});

describe('dashboardFileStem', () => {
  it('collapses a single-day range', () => {
    expect(dashboardFileStem('2026-09-21', '2026-09-21')).toBe('dashboard-2026-09-21');
    expect(dashboardFileStem('2026-09-21', '2026-09-27')).toBe('dashboard-2026-09-21_2026-09-27');
  });

  it('appends a file-safe branch name', () => {
    expect(dashboardFileStem('2026-09-21', '2026-09-21', 'คลัง บางนา / A')).toBe('dashboard-2026-09-21-คลัง_บางนา_A');
    expect(fileSafe('..')).toBe('');
    expect(fileSafe('a:b*c?')).toBe('a_b_c');
  });
});

describe('safeSheetName', () => {
  it('strips forbidden characters and caps the length', () => {
    expect(safeSheetName('a/b:c')).toBe('a b c');
    expect(safeSheetName('x'.repeat(40))).toHaveLength(31);
    expect(safeSheetName('///')).toBe('Sheet');
  });
});
