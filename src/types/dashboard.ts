import type { Insight } from '@/lib/dashboard/insights';
import type { RangeKind } from '@/lib/dashboard/date-range';

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
};

export type DashboardKpiPrev = Pick<DashboardKpi, 'total' | 'booked' | 'completed' | 'cancelled' | 'no_show' | 'utilization_pct'>;

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
};

export type DashboardNamedCount = { name: string; count: number; pct: number };

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
  shop_meta: { demo_mode_enabled: boolean; demo_business_type: string | null; line_setup_completed: boolean; shop_key: string | null };
};
