import type { ReportPreset } from '@/lib/reports/range-presets';

export type { ReportPreset };

export type ReportNamedCount = { name: string; count: number; pct: number };

export type ReportStaffStat = { name: string; count: number; completed: number; cancelled: number; no_show: number };

export type ReportBookingRow = {
  id: string;
  queue_number: string;
  booking_date: string;
  /** `HH:MM` */
  start_time: string;
  /** `HH:MM` or '' when the booking has no end time. */
  end_time: string;
  status: string;
  customer_name: string;
  customer_phone: string;
  service_name: string;
  branch_name: string;
  resource_name: string;
  note: string;
};

export type ReportData = {
  range: { preset: ReportPreset; from: string; to: string; days: number; today: string };
  shop: { name: string; logo_url: string | null };
  branch: { name: string | null };
  kpi: {
    total: number;
    /** Bookings that still occupy a slot (excludes cancelled / no-show / skipped). */
    booked: number;
    completed: number;
    cancelled: number;
    no_show: number;
    /** (cancelled + no_show) / total, percent. */
    cancel_rate: number;
    customers_new: number;
    customers_returning: number;
  };
  /**
   * Equal-length period right before `range` for look-back comparison.
   * `null` for ranges that start after today (nothing to compare yet).
   */
  prev: { from: string; to: string; total: number; completed: number; cancelled: number; no_show: number } | null;
  by_day: Array<{ date: string; count: number; completed: number; cancelled: number; no_show: number }>;
  by_hour: Array<{ hour: number; count: number }>;
  by_status: Array<{ status: string; count: number }>;
  popular_services: ReportNamedCount[];
  by_branch: ReportNamedCount[];
  by_staff: ReportStaffStat[];
  bookings: { rows: ReportBookingRow[]; total: number; truncated: boolean };
  generated_at: string;
};
