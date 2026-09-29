import type { Insight } from '@/lib/dashboard/insights';
import type { RangeKind } from '@/lib/dashboard/date-range';
import type { WarehouseBottleneckRow, WarehouseCore, WarehouseDock, WarehouseLatePartner, WarehouseLateQueue, WarehouseThresholds, WarehouseTrendPoint, WarehouseVehicle } from '@/lib/dashboard/warehouse-kpi';

export type { Insight, RangeKind };

export type DashboardKpi = {
  total: number;
  booked: number;
  completed: number;
  cancelled: number;
  no_show: number;
  serving: number;
  waiting: number;
  capacity: number;
  utilization_pct: number;
  customers_new: number;
  customers_returning: number;
  /** Average minutes from call to close over the closed queues of the range; null when none. */
  avg_queue_minutes: number | null;
  /** Closed queues the average is based on. */
  closed_queues: number;
};

export type DashboardKpiPrev = Pick<DashboardKpi, 'total' | 'booked' | 'completed' | 'cancelled' | 'no_show' | 'utilization_pct' | 'avg_queue_minutes'>;

export type DashboardDay = { date: string; count: number; capacity: number; is_holiday: boolean };
export type DashboardHour = { hour: number; count: number; capacity: number };

export type DashboardHeatmapRow = {
  /** ISO date (mode `date`) or weekday number as string (mode `weekday`). */
  key: string;
  cells: DashboardHour[];
};

export type DashboardHeatmap = {
  mode: 'date' | 'weekday';
  hours: number[];
  rows: DashboardHeatmapRow[];
};

export type DashboardWeekdayPattern = { weekday: number; avg_count: number; avg_utilization_pct: number; weeks: number };

export type DashboardRecentBooking = {
  id: string;
  queue_number: string;
  booking_date: string;
  start_time: string;
  status: string;
  customer_name: string;
  service_name: string;
  branch_name: string;
  created_at: string;
  /** Latest call to the dock; null until called. */
  called_at: string | null;
  completed_at: string | null;
  call_count: number;
};

export type DashboardNamedCount = { name: string; count: number; pct: number };

/** KPI of one branch over the selected range, for the branch comparison. */
export type DashboardBranchKpi = Pick<DashboardKpi, 'total' | 'booked' | 'completed' | 'cancelled' | 'no_show' | 'capacity' | 'utilization_pct'> & {
  branch_id: string;
  name: string;
};

export type DashboardWarehousePrev = Pick<WarehouseCore, 'dock_avg' | 'late' | 'on_time_pct' | 'turnaround_avg' | 'sla_pct' | 'per_day' | 'dock_utilization_pct' | 'no_show_pct'>;

export type DashboardWarehouseBranch = Pick<WarehouseCore, 'closed' | 'dock_avg' | 'turnaround_avg' | 'late' | 'on_time_pct' | 'dock_utilization_pct'> & { branch_id: string; name: string };

/** Warehouse KPIs of the range: dock time, delay, dock use. See `src/lib/dashboard/warehouse-kpi.ts`. */
export type DashboardWarehouse = {
  /** False when the warehouse queries failed; the figures are then empty, not zero. */
  available: boolean;
  thresholds: WarehouseThresholds;
  kpi: WarehouseCore & { per_dock_hour: number; prev: DashboardWarehousePrev };
  trend: { mode: 'day' | 'hour'; points: WarehouseTrendPoint[] };
  docks: Array<WarehouseDock & { branch_name: string }>;
  vehicles: Array<WarehouseVehicle & { name: string }>;
  bottleneck: { hours: number[]; rows: Array<WarehouseBottleneckRow & { name: string }> };
  late_queues: Array<WarehouseLateQueue & { service_name: string; dock_name: string; branch_name: string }>;
  late_partners: Array<WarehouseLatePartner & { name: string }>;
  branches: DashboardWarehouseBranch[];
  floor: { recalled: number; plate_mismatch: number; awaiting_payment: number; inbound: number; outbound: number };
};

export type DashboardData = {
  range: { kind: RangeKind; from: string; to: string; prev_from: string; prev_to: string; days: number; today: string };
  kpi: DashboardKpi & { prev: DashboardKpiPrev };
  by_day: DashboardDay[];
  by_hour: DashboardHour[];
  heatmap: DashboardHeatmap;
  weekday_pattern: DashboardWeekdayPattern[];
  by_status: Array<{ status: string; count: number }>;
  insights: Insight[];
  recent_bookings: { rows: DashboardRecentBooking[]; total: number; page: number; limit: number };
  popular_services: DashboardNamedCount[];
  branch_summary: DashboardNamedCount[];
  branch_kpi: DashboardBranchKpi[];
  warehouse: DashboardWarehouse;
  shop_meta: { demo_mode_enabled: boolean; demo_business_type: string | null; line_setup_completed: boolean; shop_key: string | null };
};
