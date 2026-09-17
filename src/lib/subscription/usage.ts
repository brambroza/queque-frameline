import { createAdminClient } from '@/lib/supabase/admin';
import { getTodayISOInBangkok } from '@/lib/utils/date-format';

/** How much of a plan a single shop is currently consuming. */
export type ShopUsage = {
  branches: number;
  services: number;
  staff: number;
  resources: number;
  bookings: number;
};

/**
 * Counts what the shop is currently consuming, so the UI can show
 * "3 / 3 บริการ" instead of only telling the owner after they hit the wall.
 *
 * Shared by the shop-facing plan card and the super-admin package editor, so
 * both surfaces report the same numbers.
 *
 * @param shopId - Tenant scope for every count.
 */
export async function countShopUsage(shopId: string): Promise<ShopUsage> {
  const admin = createAdminClient();
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const countTable = async (table: string) => {
    const { count } = await admin
      .from(table)
      .select('id', { count: 'exact', head: true })
      .eq('shop_id', shopId)
      .eq('is_deleted', false);
    return count ?? 0;
  };

  const { count: bookingCount } = await admin
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .eq('shop_id', shopId)
    .eq('is_deleted', false)
    .gte('booking_date', `${month}-01`)
    .lte('booking_date', `${month}-31`);

  const [branches, services, staff, resources] = await Promise.all([
    countTable('branches'),
    countTable('services'),
    countTable('staff'),
    countTable('resources'),
  ]);

  return { branches, services, staff, resources, bookings: bookingCount ?? 0 };
}

/** Bookings on one calendar day (Bangkok), for the daily-load series. */
export type DailyBookingPoint = { date: string; count: number };

/**
 * Booking load per day, plus the numbers a capacity decision actually needs:
 * a monthly quota says nothing about whether the shop hits 5 or 200 bookings on
 * its busiest day, and peak day is what a scale plan has to survive.
 */
export type DailyUsage = {
  days: number;
  series: DailyBookingPoint[];
  total: number;
  /** Mean over every day in the window, including days with zero bookings. */
  averagePerDay: number;
  /** Mean over days that had at least one booking — the real working-day rate. */
  averagePerActiveDay: number;
  peak: DailyBookingPoint | null;
  today: number;
  activeDays: number;
};

/** How far back the daily series looks. One booking row per booking, so keep the window bounded. */
const DAILY_WINDOW_DAYS = 30;

/** Shifts an ISO yyyy-mm-dd by whole days without touching local time zones. */
function shiftISODate(iso: string, deltaDays: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const base = Date.UTC(y, (m ?? 1) - 1, d ?? 1);
  return new Date(base + deltaDays * 86_400_000).toISOString().slice(0, 10);
}

/**
 * Daily booking load for one shop over the trailing window, so a super_admin can
 * see the per-day shape behind a monthly quota before planning capacity.
 *
 * Grouped in JS rather than SQL: the row count is bounded by one shop's bookings
 * over 30 days, and adding an RPC for it would need a migration.
 *
 * @param shopId - Tenant scope for the query.
 * @param days - Window length in days, defaults to 30.
 */
export async function getDailyBookingUsage(shopId: string, days: number = DAILY_WINDOW_DAYS): Promise<DailyUsage> {
  const admin = createAdminClient();
  const today = getTodayISOInBangkok();
  const from = shiftISODate(today, -(days - 1));

  const { data, error } = await admin
    .from('bookings')
    .select('booking_date')
    .eq('shop_id', shopId)
    .eq('is_deleted', false)
    .gte('booking_date', from)
    .lte('booking_date', today);

  const counts = new Map<string, number>();
  if (!error && data) {
    data.forEach((row) => {
      const date = String(row.booking_date ?? '').slice(0, 10);
      if (date) counts.set(date, (counts.get(date) ?? 0) + 1);
    });
  }

  const series: DailyBookingPoint[] = Array.from({ length: days }, (_, i) => {
    const date = shiftISODate(from, i);
    return { date, count: counts.get(date) ?? 0 };
  });

  const total = series.reduce((sum, point) => sum + point.count, 0);
  const activeDays = series.filter((point) => point.count > 0).length;
  const peak = series.reduce<DailyBookingPoint | null>(
    (best, point) => (best === null || point.count > best.count ? point : best),
    null,
  );

  return {
    days,
    series,
    total,
    averagePerDay: total / days,
    averagePerActiveDay: activeDays ? total / activeDays : 0,
    peak: peak && peak.count > 0 ? peak : null,
    today: counts.get(today) ?? 0,
    activeDays,
  };
}
