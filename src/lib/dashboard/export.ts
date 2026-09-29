import type { DashboardData } from '@/types/dashboard';

/** Translate function shape returned by `useTranslation(namespace)`. */
export type ExportTranslate = (key: string, fallback?: string) => string;

export type ExportCell = string | number;

export type ExportSheetKey = 'summary' | 'warehouse' | 'docks' | 'vehicles' | 'late' | 'daily' | 'hourly' | 'status' | 'services' | 'branches' | 'weekday' | 'bookings';

/** One table of the export: a worksheet in Excel, or one CSV file. */
export type ExportSheet = { key: ExportSheetKey; name: string; header: string[]; rows: ExportCell[][] };

/** Booking row of the export list — every queue whose booking date is inside the range. */
export type DashboardExportBooking = {
  booking_date: string;
  start_time: string;
  queue_number: string;
  direction: string;
  customer_name: string;
  service_name: string;
  branch_name: string;
  resource_name: string;
  plate_number: string;
  do_number: string;
  status: string;
  /** Already formatted for display (Bangkok time). */
  created_at: string;
  /** Formatted; '' when the queue was never called / not closed. */
  called_at?: string;
  completed_at?: string;
  call_count?: number;
  /** Minutes from call to close; null unless the queue is closed. */
  queue_minutes?: number | null;
};

export type DashboardExportInput = {
  /** `warehouse` may be missing on payloads built before the warehouse KPIs existed. */
  data: Omit<DashboardData, 'warehouse'> & { warehouse?: DashboardData['warehouse'] };
  bookings: DashboardExportBooking[];
  t: ExportTranslate;
  statusLabel: (status: string) => string;
};

const WEEKDAY_FALLBACK = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];

/** `HH:00` label for an hour of day. */
function hourLabel(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`;
}

/** Whole-number percentage, 0 when the denominator is 0. */
function percent(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

/**
 * Turn the dashboard payload into flat tables, in the order they appear on the
 * page. The hourly sheet is the heatmap matrix (one row per date or weekday),
 * so it carries the same numbers as the density view for any range.
 */
export function buildDashboardSheets({ data, bookings, t, statusLabel }: DashboardExportInput): ExportSheet[] {
  const { kpi, range } = data;
  const weekday = (w: number) => t(`wd_${w}`, WEEKDAY_FALLBACK[w] ?? String(w));
  const directionLabel = (d: string) => (d === 'inbound' ? t('direction_inbound', 'ขาเข้า (PO)') : d === 'outbound' ? t('direction_outbound', 'ขาออก (SO)') : d);

  const summary: ExportSheet = {
    key: 'summary',
    name: t('export_sheet_summary', 'สรุป'),
    header: [t('export_col_item', 'รายการ'), t('export_col_value', 'ค่า'), t('export_col_prev', 'ช่วงก่อนหน้า')],
    rows: [
      [t('from', 'จากวันที่'), range.from, range.prev_from],
      [t('to', 'ถึงวันที่'), range.to, range.prev_to],
      [t('export_days', 'จำนวนวัน'), range.days, ''],
      [t('export_all_records', 'คิวทุกสถานะ'), kpi.total, kpi.prev.total],
      [t('bookings_total', 'คิวทั้งหมด'), kpi.booked, kpi.prev.booked],
      [t('export_capacity', 'ความจุ (slot)'), kpi.capacity, ''],
      [t('export_utilization_pct', 'ความหนาแน่น (%)'), kpi.utilization_pct, kpi.prev.utilization_pct],
      [t('completed', 'เสร็จสิ้น'), kpi.completed, kpi.prev.completed],
      [t('cancelled', 'ยกเลิก'), kpi.cancelled, kpi.prev.cancelled],
      [t('no_show', 'ไม่มา'), kpi.no_show, kpi.prev.no_show],
      [t('export_serving', 'กำลังให้บริการ'), kpi.serving, ''],
      [t('export_waiting', 'รอเรียก'), kpi.waiting, ''],
      [t('export_customers_new', 'ลูกค้าใหม่'), kpi.customers_new, ''],
      [t('export_customers_returning', 'ลูกค้าเดิม'), kpi.customers_returning, ''],
      [t('export_avg_queue_minutes', 'เวลาเฉลี่ยต่อคิว เรียก→ปิดงาน (นาที)'), kpi.avg_queue_minutes ?? '', kpi.prev.avg_queue_minutes ?? ''],
      [t('export_closed_queues', 'คิวที่ปิดงานแล้ว (ฐานของค่าเฉลี่ย)'), kpi.closed_queues ?? '', ''],
    ],
  };

  // Warehouse KPI sheets; skipped for payloads that predate them.
  const wh = data.warehouse;
  const causeLabel = (c: string) => (c === 'warehouse' ? t('wh_by_warehouse', 'คลังเริ่มช้า') : t('wh_by_truck', 'รถมาสาย'));
  const warehouseSheets: ExportSheet[] = wh?.available
    ? [
        {
          key: 'warehouse',
          name: t('export_sheet_warehouse', 'KPI คลัง'),
          header: [t('export_col_item', 'รายการ'), t('export_col_value', 'ค่า'), t('export_col_prev', 'ช่วงก่อนหน้า')],
          rows: [
            [t('export_wh_closed', 'คิวปิดงานที่ใช้คำนวณ'), wh.kpi.closed, ''],
            [t('export_wh_incomplete', 'คิวปิดงานที่เวลาไม่ครบ (ไม่นับ)'), wh.kpi.incomplete, ''],
            [t('export_wh_dock_avg', 'เวลาที่ท่า เฉลี่ย (นาที)'), wh.kpi.dock_avg, wh.kpi.prev.dock_avg],
            [t('export_wh_dock_median', 'เวลาที่ท่า ค่ากลาง (นาที)'), wh.kpi.dock_median, ''],
            [t('export_wh_dock_p90', 'เวลาที่ท่า P90 (นาที)'), wh.kpi.dock_p90, ''],
            [t('export_wh_plan_avg', 'เวลาตามแผน เฉลี่ย (นาที)'), wh.kpi.plan_avg, ''],
            [t('export_wh_yard', 'รอในลาน เฉลี่ย (นาที)'), wh.kpi.yard_avg, ''],
            [t('export_wh_response', 'ตอบรับการเรียก เฉลี่ย (นาที)'), wh.kpi.response_avg, ''],
            [t('export_wh_turnaround', 'เวลารวมในคลัง เฉลี่ย (นาที)'), wh.kpi.turnaround_avg, wh.kpi.prev.turnaround_avg],
            [t('export_wh_late', 'คิวล่าช้า'), wh.kpi.late, wh.kpi.prev.late],
            [t('export_wh_by_warehouse', 'ล่าช้า: คลังเริ่มช้า'), wh.kpi.by_warehouse, ''],
            [t('export_wh_by_truck', 'ล่าช้า: รถมาสาย'), wh.kpi.by_truck, ''],
            [t('export_wh_overrun', 'ใช้เวลาเกินแผน'), wh.kpi.overrun, ''],
            [t('export_wh_on_time', 'ตรงเวลา (%)'), wh.kpi.on_time_pct, wh.kpi.prev.on_time_pct],
            [t('export_wh_sla', 'ผ่าน SLA (%)'), wh.kpi.sla_pct, wh.kpi.prev.sla_pct],
            [t('export_wh_per_day', 'ปริมาณงาน (คัน/วัน)'), wh.kpi.per_day, wh.kpi.prev.per_day],
            [t('export_wh_dock_use', 'การใช้ท่า (%)'), wh.kpi.dock_utilization_pct, wh.kpi.prev.dock_utilization_pct],
            [t('export_wh_tolerance', 'เกณฑ์: ช่วงยอมรับตรงเวลา (นาที)'), wh.thresholds.on_time_tolerance_min, ''],
            [t('export_wh_sla_target', 'เกณฑ์: เป้า SLA (นาที)'), wh.thresholds.sla_turnaround_min, ''],
            [t('export_wh_overrun_tol', 'เกณฑ์: เกินแผน (นาที)'), wh.thresholds.overrun_tolerance_min, ''],
          ],
        },
        {
          key: 'docks',
          name: t('export_sheet_docks', 'ท่า'),
          header: [t('branch', 'สาขา'), t('export_dock', 'ท่า'), t('export_trucks', 'จำนวนคัน'), t('export_wh_dock_avg', 'เวลาที่ท่า เฉลี่ย (นาที)'), t('export_wh_yard', 'รอในลาน เฉลี่ย (นาที)'), t('export_wh_dock_use', 'การใช้ท่า (%)')],
          rows: wh.docks.map((d) => [d.branch_name, d.name, d.count, d.avg_dock_min, d.avg_wait_min, d.utilization_pct]),
        },
        {
          key: 'vehicles',
          name: t('export_sheet_vehicles', 'เวลาตามประเภทรถ'),
          header: [t('service', 'บริการ'), t('export_trucks', 'จำนวนคัน'), t('export_actual_min', 'เวลาจริง (นาที)'), t('export_plan_min', 'เวลาตามแผน (นาที)'), t('export_wh_overrun', 'ใช้เวลาเกินแผน')],
          rows: wh.vehicles.map((v) => [v.name, v.count, v.avg_min, v.plan_min, v.overrun]),
        },
        {
          key: 'late',
          name: t('export_sheet_late', 'คิวล่าช้า'),
          header: [t('queue', 'คิว'), t('date', 'วันที่'), t('export_time', 'เวลา'), t('service', 'บริการ'), t('branch', 'สาขา'), t('export_dock', 'ท่า'), t('wh_cause', 'สาเหตุ'), t('export_late_min', 'ช้า (นาที)'), t('export_turnaround_min', 'เวลารวม (นาที)')],
          rows: wh.late_queues.map((q) => [q.queue_number, q.booking_date, q.start_time, q.service_name, q.branch_name, q.dock_name, causeLabel(q.cause), q.late_min, q.turnaround_min]),
        },
      ]
    : [];

  const daily: ExportSheet = {
    key: 'daily',
    name: t('export_sheet_daily', 'รายวัน'),
    header: [t('date', 'วันที่'), t('export_weekday', 'วัน'), t('export_count', 'จำนวนคิว'), t('export_capacity', 'ความจุ (slot)'), t('export_utilization_pct', 'ความหนาแน่น (%)'), t('export_holiday', 'วันหยุด')],
    rows: data.by_day.map((d) => [
      d.date,
      weekday(new Date(`${d.date}T12:00:00Z`).getUTCDay()),
      d.count,
      d.capacity,
      percent(d.count, d.capacity),
      d.is_holiday ? t('export_yes', 'ใช่') : '',
    ]),
  };

  const hourly: ExportSheet = {
    key: 'hourly',
    name: t('export_sheet_hourly', 'รายชั่วโมง'),
    header: [data.heatmap.mode === 'date' ? t('date', 'วันที่') : t('export_weekday_avg', 'วัน (เฉลี่ย)'), ...data.heatmap.hours.map(hourLabel)],
    rows: data.heatmap.rows.map((r) => [
      data.heatmap.mode === 'date' ? r.key : weekday(Number(r.key)),
      ...data.heatmap.hours.map((h) => r.cells.find((c) => c.hour === h)?.count ?? 0),
    ]),
  };

  const statusTotal = data.by_status.reduce((s, r) => s + r.count, 0);
  const status: ExportSheet = {
    key: 'status',
    name: t('export_sheet_status', 'สถานะ'),
    header: [t('status', 'สถานะ'), t('export_count', 'จำนวนคิว'), '%'],
    rows: data.by_status.map((r) => [statusLabel(r.status), r.count, percent(r.count, statusTotal)]),
  };

  const services: ExportSheet = {
    key: 'services',
    name: t('export_sheet_services', 'ประเภทรถ'),
    header: [t('service', 'บริการ'), t('export_count', 'จำนวนคิว'), '%'],
    rows: data.popular_services.map((r) => [r.name, r.count, r.pct]),
  };

  // Branch comparison: one row per branch in view. Older payloads without
  // `branch_kpi` fall back to the count-only summary.
  const branches: ExportSheet = data.branch_kpi?.length
    ? {
        key: 'branches',
        name: t('export_sheet_branches', 'สาขา'),
        header: [
          t('branch', 'สาขา'),
          t('export_all_records', 'คิวทุกสถานะ'),
          t('bookings_total', 'คิวทั้งหมด'),
          t('completed', 'เสร็จสิ้น'),
          t('cancelled', 'ยกเลิก'),
          t('no_show', 'ไม่มา'),
          t('export_capacity', 'ความจุ (slot)'),
          t('export_utilization_pct', 'ความหนาแน่น (%)'),
        ],
        rows: data.branch_kpi.map((b) => [b.name, b.total, b.booked, b.completed, b.cancelled, b.no_show, b.capacity, b.utilization_pct]),
      }
    : {
        key: 'branches',
        name: t('export_sheet_branches', 'สาขา'),
        header: [t('branch', 'สาขา'), t('export_count', 'จำนวนคิว'), t('export_utilization_pct', 'ความหนาแน่น (%)')],
        rows: data.branch_summary.map((r) => [r.name, r.count, r.pct]),
      };

  const weekdaySheet: ExportSheet = {
    key: 'weekday',
    name: t('export_sheet_weekday', 'แนวโน้มรายวัน'),
    header: [t('export_weekday', 'วัน'), t('export_avg_count', 'คิวเฉลี่ย/วัน'), t('export_avg_utilization', 'ความหนาแน่นเฉลี่ย (%)'), t('export_sample_days', 'จำนวนวันที่ใช้คำนวณ')],
    rows: [1, 2, 3, 4, 5, 6, 0]
      .map((w) => data.weekday_pattern.find((p) => p.weekday === w))
      .filter((p): p is NonNullable<typeof p> => Boolean(p))
      .map((p) => [weekday(p.weekday), p.avg_count, p.avg_utilization_pct, p.weeks]),
  };

  const bookingSheet: ExportSheet = {
    key: 'bookings',
    name: t('export_sheet_bookings', 'รายการคิว'),
    header: [
      t('date', 'วันที่'),
      t('export_time', 'เวลา'),
      t('queue', 'คิว'),
      t('export_direction', 'ประเภทงาน'),
      t('customer', 'ลูกค้า'),
      t('service', 'บริการ'),
      t('branch', 'สาขา'),
      t('export_dock', 'ท่า'),
      t('export_plate', 'ทะเบียนรถ'),
      t('export_do', 'เลข DO'),
      t('status', 'สถานะ'),
      t('booked_at', 'จองเมื่อ'),
      t('export_called_at', 'เรียกเมื่อ'),
      t('export_completed_at', 'ปิดงานเมื่อ'),
      t('export_queue_minutes', 'ใช้เวลา (นาที)'),
      t('export_call_count', 'จำนวนครั้งที่เรียก'),
    ],
    rows: bookings.map((b) => [
      b.booking_date,
      b.start_time,
      b.queue_number,
      directionLabel(b.direction),
      b.customer_name,
      b.service_name,
      b.branch_name,
      b.resource_name,
      b.plate_number,
      b.do_number,
      statusLabel(b.status),
      b.created_at,
      b.called_at ?? '',
      b.completed_at ?? '',
      b.queue_minutes ?? '',
      b.call_count ?? 0,
    ]),
  };

  return [summary, ...warehouseSheets, daily, hourly, status, services, branches, weekdaySheet, bookingSheet];
}

/**
 * Neutralize spreadsheet formula injection: text that a spreadsheet would
 * evaluate (`=`, `+`, `-`, `@`, tab, CR first) gets a leading apostrophe.
 * Customer and driver names are free text typed on a public link.
 */
export function guardFormula(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

/** One CSV field: numbers as-is, text formula-guarded and quoted when needed. */
export function csvField(value: ExportCell): string {
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
  const s = guardFormula(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV text of one sheet, with a BOM so Excel opens Thai text as UTF-8. */
export function sheetToCsv(sheet: ExportSheet): string {
  const lines = [sheet.header, ...sheet.rows].map((row) => row.map(csvField).join(','));
  return `﻿${lines.join('\r\n')}\r\n`;
}

/**
 * File-name-safe stem, e.g. `dashboard-2026-09-12` or
 * `dashboard-2026-09-01_2026-09-30`, with the branch appended when given.
 */
export function dashboardFileStem(from: string, to: string, branchName?: string): string {
  const stem = from === to ? `dashboard-${from}` : `dashboard-${from}_${to}`;
  const branch = branchName ? fileSafe(branchName) : '';
  return branch ? `${stem}-${branch}` : stem;
}

/** Strip what file systems reject; Thai letters are kept. */
export function fileSafe(name: string): string {
  return name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ').replace(/\s+/g, '_').replace(/^[._]+|[._]+$/g, '').slice(0, 60);
}

/** Excel worksheet names: max 31 characters, none of `\ / ? * [ ] :`. */
export function safeSheetName(name: string): string {
  const cleaned = name.replace(/[\\/?*[\]:]/g, ' ').trim().slice(0, 31);
  return cleaned || 'Sheet';
}
