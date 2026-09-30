import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuthContext, getErrorStatus } from '@/lib/auth/context';
import { applyBranchScope, applyNullableBranchScope } from '@/lib/auth/branch-scope';
import { getNowHourInBangkok, getTodayISOInBangkok } from '@/lib/utils/date-format';
import { CapacityModel, type HolidayRow, type WorkingHoursRow } from '@/lib/dashboard/capacity';
import { addDays, eachDay, resolveRange, startOfWeekMonday, weekdayOf } from '@/lib/dashboard/date-range';
import { buildInsights, pct, type HourCell, type WeekdayHourStat, type WeekdayStat } from '@/lib/dashboard/insights';
import { compareStatus, statusOccupiesSlot } from '@/lib/booking/status-meta';
import { fetchAllPages } from '@/lib/dashboard/fetch-all';
import { customerLabel } from '@/lib/booking/customer-label';
import { averageClosedMinutes, closedMinutes } from '@/lib/dashboard/queue-duration';
import {
  DEFAULT_THRESHOLDS,
  bottleneck,
  delayTrend,
  floorStats,
  latePartners,
  latestQueues,
  summarizeCore,
  summarizeDocks,
  summarizeVehicles,
  timeQueues,
  type DockInfo,
  type WarehouseRow,
} from '@/lib/dashboard/warehouse-kpi';
import { resolveBranchSelection } from '@/lib/dashboard/branch-selection';
import type { DashboardBranchKpi, DashboardWarehouse, DashboardData, DashboardDay, DashboardHeatmap, DashboardKpi, DashboardKpiPrev, DashboardNamedCount } from '@/types/dashboard';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const QuerySchema = z.object({
  range: z.enum(['today', 'week', 'month', 'custom']).default('today'),
  from: z.string().regex(ISO_DATE).optional(),
  to: z.string().regex(ISO_DATE).optional(),
  branch_id: z.string().uuid().optional(),
  /** Several branches at once, comma separated. */
  branch_ids: z.string().regex(/^[0-9a-fA-F-]{36}(,[0-9a-fA-F-]{36}){0,49}$/).optional(),
  direction: z.enum(['inbound', 'outbound']).optional(),
  recent_page: z.coerce.number().int().min(1).default(1),
  recent_limit: z.coerce.number().int().min(1).max(50).default(10),
});

/** Weeks of history behind the current week used for the weekday pattern. */
const PATTERN_WEEKS = 8;
/** Days after today scanned for over-capacity hours (movable-queue insight). */
const LOOKAHEAD_DAYS = 3;
/** Ranges longer than this collapse the heatmap to weekday rows. */
const HEATMAP_DATE_ROWS_MAX = 14;

type LightBooking = {
  booking_date: string;
  start_time: string;
  status: string;
  customer_id: string | null;
  service_id: string | null;
  branch_id: string | null;
  called_at: string | null;
  completed_at: string | null;
};

/** Queue row of the warehouse KPIs as PostgREST returns it, with the document embedded. */
type WarehouseDbRow = Omit<WarehouseRow, 'awaiting_payment'> & { external_documents: { doc_type?: string | null; payment_status?: string | null } | null };

const WAREHOUSE_SELECT =
  'id,queue_number,booking_date,start_time,status,direction,branch_id,resource_id,service_id,customer_id,service_minutes,checked_in_at,called_at,serving_started_at,completed_at,call_count,plate_number,plate_number_actual,booking_source,external_documents(doc_type,payment_status)';

type HeavyBooking = {
  id: string;
  queue_number: string;
  booking_date: string;
  start_time: string;
  status: string;
  created_at: string;
  called_at: string | null;
  completed_at: string | null;
  call_count: number | null;
  services: { service_name?: string } | null;
  branches: { branch_name?: string } | null;
  customers: { full_name?: string | null; nickname?: string | null } | null;
};

/** Hour of day from a Postgres `time` value (`HH:MM:SS`). */
function hourOf(startTime: string): number {
  const h = Number.parseInt(String(startTime).slice(0, 2), 10);
  return Number.isFinite(h) ? h : 0;
}

/** Hourly cells for one date over the given hour axis. */
function hourCells(rows: LightBooking[], date: string, hours: number[], model: CapacityModel): HourCell[] {
  const counts = new Map<number, number>();
  for (const r of rows) {
    if (r.booking_date !== date || !statusOccupiesSlot(r.status)) continue;
    const h = hourOf(r.start_time);
    counts.set(h, (counts.get(h) ?? 0) + 1);
  }
  return hours.map((hour) => ({ hour, count: counts.get(hour) ?? 0, capacity: model.hourlyCapacity(date, hour) }));
}

function summarize(rows: LightBooking[], from: string, to: string, model: CapacityModel): Omit<DashboardKpi, 'customers_new' | 'customers_returning'> {
  // Call → close, over the queues of the range that were closed.
  const inRange = rows.filter((r) => r.booking_date >= from && r.booking_date <= to);
  const count = (pred: (s: string) => boolean) => inRange.filter((r) => pred(r.status)).length;
  const booked = count(statusOccupiesSlot);
  const capacity = eachDay(from, to).reduce((s, d) => s + model.dailyCapacity(d), 0);
  return {
    total: inRange.length,
    booked,
    completed: count((s) => s === 'completed'),
    cancelled: count((s) => s === 'cancelled'),
    no_show: count((s) => s === 'no_show'),
    serving: count((s) => s === 'serving' || s === 'in_service'),
    waiting: count((s) => s === 'waiting' || s === 'called' || s === 'checked_in' || s === 'seating'),
    capacity,
    utilization_pct: pct(booked, capacity),
    avg_queue_minutes: averageClosedMinutes(inRange),
    closed_queues: inRange.filter((r) => closedMinutes(r) !== null).length,
  };
}

export async function GET(req: Request) {
  try {
    const { supabase, profile, user, capabilities } = await requireAuthContext({ roles: ['admin', 'staff', 'viewer'] });
    const url = new URL(req.url);
    const parsed = QuerySchema.safeParse(Object.fromEntries(url.searchParams.entries()));
    if (!parsed.success) return NextResponse.json({ error: 'Invalid query' }, { status: 400 });
    const query = parsed.data;

    let targetShopId = profile.shop_id;
    if (!targetShopId) {
      const { data: roleContext } = await supabase
        .from('user_roles')
        .select('shop_id')
        .eq('user_id', user.id)
        .eq('is_deleted', false)
        .not('shop_id', 'is', null)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      targetShopId = roleContext?.shop_id ?? null;
    }
    // A super_admin picks the shop in the topbar (acting-shop cookie); no silent fallback
    // to an arbitrary shop, otherwise the numbers would not match what the shell shows.
    if (!targetShopId) return NextResponse.json({ error: 'Select a shop first', code: 'SHOP_REQUIRED' }, { status: 400 });

    // Branches this view runs over: what was asked for, held to the caller's role.
    const visible = await applyBranchScope(
      supabase.from('branches').select('id', { count: 'exact', head: true }).eq('shop_id', targetShopId).eq('is_deleted', false),
      capabilities.branchScope,
      null,
      'id',
    );
    if (visible.error) throw visible.error;
    const selection = resolveBranchSelection(url.searchParams, capabilities, visible.count ?? 0);
    if (!selection.ok) return NextResponse.json({ error: selection.error, code: selection.code }, { status: selection.status });
    const branchScope = selection.scope;
    const requestedBranchId = null;

    const today = getTodayISOInBangkok();
    const nowHour = getNowHourInBangkok();
    let range;
    try {
      range = resolveRange(query.range, today, query.from, query.to);
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : 'Invalid range' }, { status: 400 });
    }

    // Pattern window: the 8 full weeks before the current week.
    const patternEnd = addDays(startOfWeekMonday(today), -1);
    const patternStart = addDays(patternEnd, -(PATTERN_WEEKS * 7 - 1));
    const lookaheadEnd = addDays(today, LOOKAHEAD_DAYS);
    const windowFrom = [range.from, range.prev_from, patternStart].sort()[0];
    const windowTo = [range.to, lookaheadEnd].sort().reverse()[0];

    const recentOffset = (query.recent_page - 1) * query.recent_limit;

    /** Narrow a bookings query to the requested direction, when one was asked for. */
    const byDirection = <Q,>(q: Q): Q => (query.direction ? ((q as unknown as { eq: (c: string, v: string) => Q }).eq('direction', query.direction)) : q);

    const [branchesRes, servicesRes, lightRes, recentRes, whRes, holRes, shopRes, docksRes, warehouseRes] = await Promise.all([
      applyBranchScope(
        supabase.from('branches').select('id,branch_name').eq('shop_id', targetShopId).eq('is_deleted', false),
        branchScope,
        requestedBranchId,
        'id',
      ),
      supabase.from('services').select('id,service_name').eq('shop_id', targetShopId).eq('is_deleted', false),
      // The window spans the range, the comparison range, 8 pattern weeks and
      // the lookahead — well past PostgREST's 1000-row cap for a busy shop, so
      // page it rather than let a single request silently truncate the KPIs.
      fetchAllPages<LightBooking>((from, to) =>
        applyBranchScope(
          byDirection(
            supabase
              .from('bookings')
              .select('booking_date,start_time,status,customer_id,service_id,branch_id,called_at,completed_at')
              .eq('shop_id', targetShopId)
              .eq('is_deleted', false)
              .gte('booking_date', windowFrom)
              .lte('booking_date', windowTo),
          ),
          branchScope,
          requestedBranchId,
        )
          .order('booking_date', { ascending: true })
          .order('start_time', { ascending: true })
          .order('id', { ascending: true })
          .range(from, to),
      ),
      applyBranchScope(
        byDirection(
          supabase
            .from('bookings')
            .select('id,queue_number,booking_date,start_time,status,created_at,called_at,completed_at,call_count,services(service_name),branches(branch_name),customers(full_name,nickname)', { count: 'exact' })
            .eq('shop_id', targetShopId)
            .eq('is_deleted', false)
            .gte('booking_date', range.from)
            .lte('booking_date', range.to),
        ),
        branchScope,
        requestedBranchId,
      )
        .order('created_at', { ascending: false })
        .range(recentOffset, recentOffset + query.recent_limit - 1),
      applyNullableBranchScope(
        supabase
          .from('working_hours')
          .select('branch_id,weekday,open_time,close_time,break_start,break_end,slot_interval_minutes,capacity_per_slot,active')
          .eq('shop_id', targetShopId)
          .eq('is_deleted', false)
          .eq('active', true),
        branchScope,
        requestedBranchId,
      ),
      applyNullableBranchScope(
        supabase
          .from('holidays')
          .select('branch_id,holiday_date')
          .eq('shop_id', targetShopId)
          .eq('is_deleted', false)
          .gte('holiday_date', windowFrom)
          .lte('holiday_date', windowTo),
        branchScope,
        requestedBranchId,
      ),
      supabase.from('shops').select('id,demo_mode_enabled,demo_business_type,line_setup_completed,shop_key').eq('id', targetShopId).maybeSingle(),
      applyNullableBranchScope(
        supabase.from('booking_resources').select('id,resource_name,branch_id').eq('shop_id', targetShopId).eq('is_deleted', false).eq('resource_type', 'dock'),
        branchScope,
        requestedBranchId,
      ).order('resource_name', { ascending: true }),
      // Selected range + the period before it, with the timestamps the warehouse KPIs read.
      fetchAllPages<WarehouseDbRow>((from, to) =>
        applyBranchScope(
          byDirection(
            supabase
              .from('bookings')
              .select(WAREHOUSE_SELECT)
              .eq('shop_id', targetShopId)
              .eq('is_deleted', false)
              .gte('booking_date', range.prev_from)
              .lte('booking_date', range.to),
          ),
          branchScope,
          requestedBranchId,
        )
          .order('booking_date', { ascending: true })
          .order('start_time', { ascending: true })
          .order('id', { ascending: true })
          .range(from, to) as unknown as PromiseLike<{ data: WarehouseDbRow[] | null; error: unknown }>,
      ),
    ]);

    const firstError = branchesRes.error ?? servicesRes.error ?? lightRes.error ?? recentRes.error ?? whRes.error ?? holRes.error;
    // The warehouse block reads newer columns; if it cannot load, the rest of the dashboard still answers.
    const warehouseAvailable = !docksRes.error && !warehouseRes.error;
    if (firstError) throw firstError;

    const branches = (branchesRes.data ?? []) as Array<{ id: string; branch_name: string }>;
    const services = (servicesRes.data ?? []) as Array<{ id: string; service_name: string }>;
    const rows = lightRes.data;
    const model = new CapacityModel(
      branches.map((b) => b.id),
      (whRes.data ?? []) as WorkingHoursRow[],
      (holRes.data ?? []) as HolidayRow[],
    );
    const hours = model.openHours();

    // ── Range aggregates ──
    const rangeRows = rows.filter((r) => r.booking_date >= range.from && r.booking_date <= range.to);
    const rangeDays = eachDay(range.from, range.to);
    const byDay: DashboardDay[] = rangeDays.map((date) => ({
      date,
      count: rangeRows.filter((r) => r.booking_date === date && statusOccupiesSlot(r.status)).length,
      capacity: model.dailyCapacity(date),
      is_holiday: model.isFullHoliday(date),
    }));

    const hoursByDate = new Map<string, HourCell[]>();
    for (const date of new Set([...rangeDays, ...eachDay(today, lookaheadEnd)])) hoursByDate.set(date, hourCells(rows, date, hours, model));

    const heatmap: DashboardHeatmap =
      range.days <= HEATMAP_DATE_ROWS_MAX
        ? { mode: 'date', hours, rows: rangeDays.map((date) => ({ key: date, cells: hoursByDate.get(date) ?? [] })) }
        : {
            mode: 'weekday',
            hours,
            rows: [1, 2, 3, 4, 5, 6, 0].map((w) => {
              const dates = rangeDays.filter((d) => weekdayOf(d) === w);
              const cells = hours.map((hour, i) => {
                const n = dates.length || 1;
                const sum = dates.reduce((s, d) => s + (hoursByDate.get(d)?.[i]?.count ?? 0), 0);
                const cap = dates.reduce((s, d) => s + (hoursByDate.get(d)?.[i]?.capacity ?? 0), 0);
                return { hour, count: Math.round((sum / n) * 10) / 10, capacity: Math.round((cap / n) * 10) / 10 };
              });
              return { key: String(w), cells };
            }),
          };

    // ── 8-week weekday pattern (independent of the selected range) ──
    const patternAcc = Array.from({ length: 7 }, () => ({ count: 0, capacity: 0, days: 0 }));
    const cellAcc = new Map<string, { util: number; n: number }>();
    for (const date of eachDay(patternStart, patternEnd)) {
      const cap = model.dailyCapacity(date);
      if (cap === 0) continue;
      const w = weekdayOf(date);
      const acc = patternAcc[w];
      acc.count += rows.filter((r) => r.booking_date === date && statusOccupiesSlot(r.status)).length;
      acc.capacity += cap;
      acc.days += 1;
      for (const c of hourCells(rows, date, hours, model)) {
        if (c.capacity === 0) continue;
        const key = `${w}-${c.hour}`;
        const prev = cellAcc.get(key) ?? { util: 0, n: 0 };
        cellAcc.set(key, { util: prev.util + c.count / c.capacity, n: prev.n + 1 });
      }
    }
    const weekdayPattern: WeekdayStat[] = patternAcc.map((a, weekday) => ({
      weekday,
      avg_count: a.days ? Math.round((a.count / a.days) * 10) / 10 : 0,
      avg_utilization_pct: pct(a.count, a.capacity),
      weeks: a.days,
    }));
    const weekdayHour: WeekdayHourStat[] = Array.from(cellAcc.entries()).map(([key, v]) => {
      const [w, h] = key.split('-').map(Number);
      return { weekday: w, hour: h, avg_utilization_pct: Math.round((v.util / v.n) * 100), samples: v.n };
    });

    // ── KPI + previous period ──
    const kpiBase = summarize(rows, range.from, range.to, model);
    const prevBase = summarize(rows, range.prev_from, range.prev_to, model);

    const customerIds = Array.from(new Set(rangeRows.map((r) => r.customer_id).filter((id): id is string => Boolean(id))));
    const returningIds = new Set<string>();
    for (let i = 0; i < customerIds.length && i < 2000; i += 200) {
      const chunk = customerIds.slice(i, i + 200);
      const { data: earlier } = await supabase
        .from('bookings')
        .select('customer_id')
        .eq('shop_id', targetShopId)
        .eq('is_deleted', false)
        .lt('booking_date', range.from)
        .in('customer_id', chunk);
      for (const e of (earlier ?? []) as Array<{ customer_id: string | null }>) if (e.customer_id) returningIds.add(e.customer_id);
    }
    const kpi: DashboardKpi & { prev: DashboardKpiPrev } = {
      ...kpiBase,
      customers_new: customerIds.length - returningIds.size,
      customers_returning: returningIds.size,
      prev: {
        total: prevBase.total,
        booked: prevBase.booked,
        completed: prevBase.completed,
        cancelled: prevBase.cancelled,
        no_show: prevBase.no_show,
        utilization_pct: prevBase.utilization_pct,
        avg_queue_minutes: prevBase.avg_queue_minutes,
      },
    };

    // ── Status / services / branches ──
    const statusMap = new Map<string, number>();
    const serviceMap = new Map<string, number>();
    const branchMap = new Map<string, number>();
    for (const r of rangeRows) {
      statusMap.set(r.status, (statusMap.get(r.status) ?? 0) + 1);
      if (r.service_id) serviceMap.set(r.service_id, (serviceMap.get(r.service_id) ?? 0) + 1);
      if (r.branch_id && statusOccupiesSlot(r.status)) branchMap.set(r.branch_id, (branchMap.get(r.branch_id) ?? 0) + 1);
    }
    const byStatus = Array.from(statusMap.entries())
      .map(([status, count]) => ({ status, count }))
      .sort((a, b) => compareStatus(a.status, b.status));
    const serviceName = new Map(services.map((s) => [s.id, s.service_name]));
    const popularServices: DashboardNamedCount[] = Array.from(serviceMap.entries())
      .map(([id, count]) => ({ name: serviceName.get(id) ?? 'Unknown', count, pct: pct(count, rangeRows.length) }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
    const branchSummary: DashboardNamedCount[] = branches
      .map((b) => {
        const count = branchMap.get(b.id) ?? 0;
        const single = new CapacityModel([b.id], (whRes.data ?? []) as WorkingHoursRow[], (holRes.data ?? []) as HolidayRow[]);
        const capacity = rangeDays.reduce((s, d) => s + single.dailyCapacity(d), 0);
        return { name: b.branch_name, count, pct: pct(count, capacity) };
      })
      .sort((a, b) => b.count - a.count);

    const branchKpi: DashboardBranchKpi[] = branches.map((b) => {
      const single = new CapacityModel([b.id], (whRes.data ?? []) as WorkingHoursRow[], (holRes.data ?? []) as HolidayRow[]);
      const base = summarize(rows.filter((r) => r.branch_id === b.id), range.from, range.to, single);
      return { branch_id: b.id, name: b.branch_name, total: base.total, booked: base.booked, completed: base.completed, cancelled: base.cancelled, no_show: base.no_show, capacity: base.capacity, utilization_pct: base.utilization_pct };
    });

    // ── Warehouse KPIs ──
    const workingHours = (whRes.data ?? []) as WorkingHoursRow[];
    const holidayRows = (holRes.data ?? []) as HolidayRow[];
    const branchModels = new Map(branches.map((b) => [b.id, new CapacityModel([b.id], workingHours, holidayRows)]));
    /** Minutes one branch is open over the days given (hours with capacity × 60). */
    const openMinutes = (branchId: string | null, days: string[]): number => {
      const m = branchId ? branchModels.get(branchId) : undefined;
      return m ? days.reduce((s, d) => s + m.hourlyProfile(d).size * 60, 0) : 0;
    };
    // Days still ahead carry no finished work, so they do not count as working days.
    const elapsedDays = rangeDays.filter((d) => d <= today);
    const prevDays = eachDay(range.prev_from, range.prev_to);
    const dockRows = ((warehouseAvailable ? docksRes.data : null) ?? []) as Array<{ id: string; resource_name: string; branch_id: string | null }>;
    const dockInfo = (days: string[]): DockInfo[] => dockRows.map((d) => ({ id: d.id, name: d.resource_name, branch_id: d.branch_id, open_minutes: openMinutes(d.branch_id, days) }));
    const docksNow = dockInfo(elapsedDays);
    const totalOpen = (list: DockInfo[]) => list.reduce((s, d) => s + d.open_minutes, 0);
    const openDays = (days: string[]) => days.filter((d) => model.dailyCapacity(d) > 0).length;

    const warehouseRows: WarehouseRow[] = (warehouseAvailable ? warehouseRes.data : []).map(({ external_documents: doc, ...r }) => ({
      ...r,
      awaiting_payment: doc?.doc_type === 'so' && (doc.payment_status ?? 'unpaid') === 'unpaid',
    }));
    const nowRows = warehouseRows.filter((r) => r.booking_date >= range.from && r.booking_date <= range.to);
    const prevRows = warehouseRows.filter((r) => r.booking_date >= range.prev_from && r.booking_date <= range.prev_to);
    const th = DEFAULT_THRESHOLDS;
    const core = summarizeCore(nowRows, th, openDays(elapsedDays), totalOpen(docksNow));
    const prevCore = summarizeCore(prevRows, th, openDays(prevDays), totalOpen(dockInfo(prevDays)));
    const { timed } = timeQueues(nowRows, th);
    const dockName = new Map(dockRows.map((d) => [d.id, d.resource_name]));
    const branchName = new Map(branches.map((b) => [b.id, b.branch_name]));

    const partners = latePartners(timed, range.days === 1 ? 1 : 3);
    const partnerNames = new Map<string, string>();
    if (partners.length > 0) {
      const { data: named } = await supabase
        .from('customers')
        .select('id,full_name,nickname')
        .eq('shop_id', targetShopId)
        .in('id', partners.map((p) => p.customer_id));
      for (const c of (named ?? []) as Array<{ id: string; full_name: string | null; nickname: string | null }>) partnerNames.set(c.id, customerLabel(c));
    }

    const activeDocks = summarizeDocks(timed, docksNow).filter((d) => d.count > 0).length;
    const warehouse: DashboardWarehouse = {
      available: warehouseAvailable,
      thresholds: th,
      kpi: {
        ...core,
        per_dock_hour: activeDocks && hours.length ? Math.round((core.per_day / (activeDocks * hours.length)) * 10) / 10 : 0,
        prev: {
          dock_avg: prevCore.dock_avg,
          late: prevCore.late,
          on_time_pct: prevCore.on_time_pct,
          turnaround_avg: prevCore.turnaround_avg,
          sla_pct: prevCore.sla_pct,
          per_day: prevCore.per_day,
          dock_utilization_pct: prevCore.dock_utilization_pct,
          no_show_pct: prevCore.no_show_pct,
        },
      },
      trend: range.days === 1 ? { mode: 'hour', points: delayTrend(timed, 'hour', hours.map(String)) } : { mode: 'day', points: delayTrend(timed, 'day', rangeDays) },
      docks: summarizeDocks(timed, docksNow).map((d) => ({ ...d, branch_name: (d.branch_id && branchName.get(d.branch_id)) || '' })),
      vehicles: summarizeVehicles(timed).map((v) => ({ ...v, name: serviceName.get(v.service_id) ?? '-' })),
      bottleneck: { hours, rows: bottleneck(timed, docksNow, hours).map((r) => ({ ...r, name: dockName.get(r.dock_id) ?? '-' })) },
      late_queues: latestQueues(timed).map((q) => ({
        ...q,
        service_name: (q.service_id && serviceName.get(q.service_id)) || '-',
        dock_name: (q.resource_id && dockName.get(q.resource_id)) || '-',
        branch_name: (q.branch_id && branchName.get(q.branch_id)) || '-',
      })),
      late_partners: partners.map((p) => ({ ...p, name: partnerNames.get(p.customer_id) ?? '-' })),
      branches: branches.map((b) => {
        const mine = docksNow.filter((d) => d.branch_id === b.id);
        const single = branchModels.get(b.id);
        const days = single ? elapsedDays.filter((d) => single.dailyCapacity(d) > 0).length : 0;
        const c = summarizeCore(nowRows.filter((r) => r.branch_id === b.id), th, days, totalOpen(mine));
        return { branch_id: b.id, name: b.branch_name, closed: c.closed, dock_avg: c.dock_avg, turnaround_avg: c.turnaround_avg, late: c.late, on_time_pct: c.on_time_pct, dock_utilization_pct: c.dock_utilization_pct };
      }),
      floor: floorStats(nowRows),
    };

    const insights = buildInsights({
      today,
      now_hour: nowHour,
      by_day: byDay,
      hours_by_date: hoursByDate,
      weekday_pattern: weekdayPattern,
      weekday_hour: weekdayHour,
      kpi: { total: kpi.total, cancelled: kpi.cancelled, no_show: kpi.no_show },
      prev_kpi: { total: prevBase.total, cancelled: prevBase.cancelled, no_show: prevBase.no_show },
    });

    const recentRows = ((recentRes.data ?? []) as unknown as HeavyBooking[]).map((b) => ({
      id: b.id,
      queue_number: b.queue_number,
      booking_date: b.booking_date,
      start_time: String(b.start_time).slice(0, 5),
      status: b.status,
      customer_name: customerLabel(b.customers),
      service_name: b.services?.service_name ?? '-',
      branch_name: b.branches?.branch_name ?? '-',
      created_at: b.created_at,
      called_at: b.called_at ?? null,
      completed_at: b.completed_at ?? null,
      call_count: b.call_count ?? 0,
    }));

    const shopMeta = shopRes.data as { demo_mode_enabled?: boolean; demo_business_type?: string | null; line_setup_completed?: boolean; shop_key?: string | null } | null;

    const data: DashboardData = {
      range: { ...range, today },
      kpi,
      by_day: byDay,
      by_hour: range.kind === 'today' ? (hoursByDate.get(today) ?? []) : [],
      heatmap,
      weekday_pattern: weekdayPattern,
      by_status: byStatus,
      insights,
      recent_bookings: { rows: recentRows, total: recentRes.count ?? recentRows.length, page: query.recent_page, limit: query.recent_limit },
      popular_services: popularServices,
      branch_summary: branchSummary,
      branch_kpi: branchKpi,
      warehouse,
      shop_meta: {
        demo_mode_enabled: Boolean(shopMeta?.demo_mode_enabled),
        demo_business_type: shopMeta?.demo_business_type ?? null,
        line_setup_completed: Boolean(shopMeta?.line_setup_completed),
        shop_key: shopMeta?.shop_key ?? null,
      },
    };

    return NextResponse.json({ data });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}
