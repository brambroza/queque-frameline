import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuthContext, getErrorStatus } from '@/lib/auth/context';
import { applyBranchScope } from '@/lib/auth/branch-scope';
import { getTodayISOInBangkok } from '@/lib/utils/date-format';
import { fetchAllPages } from '@/lib/dashboard/fetch-all';
import { addDays, eachDay } from '@/lib/dashboard/date-range';
import { compareStatus, statusOccupiesSlot } from '@/lib/booking/status-meta';
import { customerLabel } from '@/lib/booking/customer-label';
import { pct } from '@/lib/dashboard/insights';
import { isISODate, REPORT_PRESETS, resolveReportRange, type ReportPreset } from '@/lib/reports/range-presets';
import type { ReportBookingRow, ReportData, ReportNamedCount, ReportStaffStat } from '@/types/reports';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const QuerySchema = z.object({
  mode: z.enum(['json', 'csv']).default('json'),
  /** CSV layout: per day (default), per staff/resource, or the booking list. */
  group: z.enum(['day', 'staff', 'bookings']).default('day'),
  preset: z.enum(REPORT_PRESETS as [ReportPreset, ...ReportPreset[]]).optional(),
  from: z.string().regex(ISO_DATE).optional(),
  to: z.string().regex(ISO_DATE).optional(),
  branch_id: z.string().uuid().optional(),
  service_id: z.string().uuid().optional(),
  resource_id: z.union([z.literal('none'), z.string().uuid()]).optional(),
});

/** Booking rows returned in the JSON body / CSV; larger ranges are truncated and flagged. */
const BOOKINGS_MAX = 1000;
/** Label for bookings that have no resource/staff assigned. */
const UNASSIGNED_LABEL = 'ไม่ระบุ';

type BookingRow = {
  id: string;
  booking_date: string;
  start_time: string;
  end_time: string | null;
  queue_number: string;
  status: string;
  note: string | null;
  service_id: string | null;
  branch_id: string | null;
  resource_id: string | null;
  resource_name: string | null;
  customer_id: string | null;
  customers: { id?: string; full_name?: string | null; nickname?: string | null; phone?: string | null } | null;
  services: { service_name?: string } | null;
  branches: { branch_name?: string } | null;
};

function csvEscape(v: unknown): string {
  const s = String(v ?? '');
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function csvResponse(lines: string[], filename: string): NextResponse {
  // BOM so Excel opens Thai text as UTF-8.
  return new NextResponse(`﻿${lines.join('\n')}`, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename=${filename}`,
    },
  });
}

/** `HH:MM` from a Postgres `time` value, '' when null. */
function hhmm(v: string | null | undefined): string {
  return v ? String(v).slice(0, 5) : '';
}

function hourOf(startTime: string): number {
  const h = Number.parseInt(String(startTime).slice(0, 2), 10);
  return Number.isFinite(h) ? h : 0;
}

/**
 * Report over a date range: KPIs, per-day / per-hour / per-status breakdowns,
 * per-service / per-branch / per-staff tallies and the booking list itself.
 *
 * `?mode=csv&group=day|staff|bookings` returns the matching table as CSV.
 * Range comes from `preset` (see `resolveReportRange`) or a `from`/`to` pair.
 */
export async function GET(req: Request) {
  try {
    const { supabase, profile, branchScope } = await requireAuthContext({ roles: ['super_admin', 'shop_owner', 'branch_manager'] });
    const url = new URL(req.url);
    const parsed = QuerySchema.safeParse(Object.fromEntries(url.searchParams.entries()));
    if (!parsed.success) return NextResponse.json({ error: 'Invalid query' }, { status: 400 });
    const query = parsed.data;

    const shopId = profile.shop_id;
    if (!shopId) return NextResponse.json({ error: 'Select a shop first', code: 'SHOP_REQUIRED' }, { status: 400 });

    const today = getTodayISOInBangkok();
    // Legacy callers pass only from/to — treat that as a custom range.
    const preset: ReportPreset = query.preset ?? (isISODate(query.from) ? 'custom' : 'today');
    let range;
    try {
      range = resolveReportRange(preset, today, query.from, query.to ?? query.from);
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : 'Invalid range' }, { status: 400 });
    }

    const requestedBranchId = query.branch_id ?? null;

    const [shopRes, branchRes, listRes] = await Promise.all([
      supabase.from('shops').select('name,logo_url').eq('id', shopId).maybeSingle(),
      requestedBranchId
        ? supabase.from('branches').select('branch_name').eq('id', requestedBranchId).eq('shop_id', shopId).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      fetchAllPages<BookingRow>((fromRow, toRow) => {
        let q = supabase
          .from('bookings')
          .select('id,booking_date,start_time,end_time,queue_number,status,note,service_id,branch_id,resource_id,resource_name,customer_id,customers(id,full_name,nickname,phone),services(service_name),branches(branch_name)')
          .eq('shop_id', shopId)
          .eq('is_deleted', false)
          .gte('booking_date', range.from)
          .lte('booking_date', range.to);
        q = applyBranchScope(q, branchScope, requestedBranchId);
        if (query.service_id) q = q.eq('service_id', query.service_id);
        if (query.resource_id) q = query.resource_id === 'none' ? q.is('resource_id', null) : q.eq('resource_id', query.resource_id);
        // Supabase types embedded relations as arrays; the FK side is a single object at runtime.
        return q
          .order('booking_date', { ascending: true })
          .order('start_time', { ascending: true })
          .order('id', { ascending: true })
          .range(fromRow, toRow)
          .then((r) => ({ data: r.data as unknown as BookingRow[] | null, error: r.error }));
      }),
    ]);

    if (shopRes.error) throw shopRes.error;
    if (branchRes.error) throw branchRes.error;
    if (listRes.error) throw listRes.error;

    const rows = listRes.data;
    const total = rows.length;
    const countStatus = (s: string) => rows.filter((r) => r.status === s).length;
    const cancelled = countStatus('cancelled');
    const noShow = countStatus('no_show');
    const completed = countStatus('completed');
    const booked = rows.filter((r) => statusOccupiesSlot(r.status)).length;

    // ── Per day (every calendar day in range, so charts show gaps) ──
    const byDay = eachDay(range.from, range.to).map((date) => {
      const day = rows.filter((r) => r.booking_date === date);
      return {
        date,
        count: day.length,
        completed: day.filter((r) => r.status === 'completed').length,
        cancelled: day.filter((r) => r.status === 'cancelled').length,
        no_show: day.filter((r) => r.status === 'no_show').length,
      };
    });

    // ── Per hour (only meaningful for a single day, but cheap to always return) ──
    const hourMap = new Map<number, number>();
    for (const r of rows) hourMap.set(hourOf(r.start_time), (hourMap.get(hourOf(r.start_time)) ?? 0) + 1);
    const byHour = Array.from(hourMap.entries())
      .map(([hour, count]) => ({ hour, count }))
      .sort((a, b) => a.hour - b.hour);

    // ── Status / service / branch ──
    const statusMap = new Map<string, number>();
    const serviceMap = new Map<string, number>();
    const branchMap = new Map<string, number>();
    for (const r of rows) {
      statusMap.set(r.status, (statusMap.get(r.status) ?? 0) + 1);
      const svc = r.services?.service_name ?? '-';
      serviceMap.set(svc, (serviceMap.get(svc) ?? 0) + 1);
      const br = r.branches?.branch_name ?? '-';
      branchMap.set(br, (branchMap.get(br) ?? 0) + 1);
    }
    const byStatus = Array.from(statusMap.entries())
      .map(([status, count]) => ({ status, count }))
      .sort((a, b) => compareStatus(a.status, b.status));
    const named = (m: Map<string, number>): ReportNamedCount[] =>
      Array.from(m.entries())
        .map(([name, count]) => ({ name, count, pct: pct(count, total) }))
        .sort((a, b) => b.count - a.count);

    // ── Per resource — for a gym this is the per-trainer breakdown ──
    const staffMap = new Map<string, ReportStaffStat>();
    for (const r of rows) {
      const name = r.resource_name || UNASSIGNED_LABEL;
      const stat = staffMap.get(name) ?? { name, count: 0, completed: 0, cancelled: 0, no_show: 0 };
      stat.count += 1;
      if (r.status === 'completed') stat.completed += 1;
      if (r.status === 'cancelled') stat.cancelled += 1;
      if (r.status === 'no_show') stat.no_show += 1;
      staffMap.set(name, stat);
    }
    const byStaff = Array.from(staffMap.values()).sort((a, b) => b.count - a.count);

    // ── Previous period of equal length (look-back ranges only) ──
    let prev: ReportData['prev'] = null;
    if (range.from <= today) {
      const prevTo = addDays(range.from, -1);
      const prevFrom = addDays(range.from, -range.days);
      let pq = supabase
        .from('bookings')
        .select('status')
        .eq('shop_id', shopId)
        .eq('is_deleted', false)
        .gte('booking_date', prevFrom)
        .lte('booking_date', prevTo);
      pq = applyBranchScope(pq, branchScope, requestedBranchId);
      if (query.service_id) pq = pq.eq('service_id', query.service_id);
      if (query.resource_id) pq = query.resource_id === 'none' ? pq.is('resource_id', null) : pq.eq('resource_id', query.resource_id);
      const { data: prevRows, error: prevError } = await pq;
      if (prevError) throw prevError;
      const p = (prevRows ?? []) as Array<{ status: string }>;
      prev = {
        from: prevFrom,
        to: prevTo,
        total: p.length,
        completed: p.filter((r) => r.status === 'completed').length,
        cancelled: p.filter((r) => r.status === 'cancelled').length,
        no_show: p.filter((r) => r.status === 'no_show').length,
      };
    }

    // ── New vs returning: returning = had a booking before the range (same rule as the dashboard) ──
    const customerIds = Array.from(new Set(rows.map((r) => r.customer_id).filter((id): id is string => Boolean(id))));
    const returningIds = new Set<string>();
    for (let i = 0; i < customerIds.length && i < 2000; i += 200) {
      const chunk = customerIds.slice(i, i + 200);
      const { data: earlier } = await supabase
        .from('bookings')
        .select('customer_id')
        .eq('shop_id', shopId)
        .eq('is_deleted', false)
        .lt('booking_date', range.from)
        .in('customer_id', chunk);
      for (const e of (earlier ?? []) as Array<{ customer_id: string | null }>) if (e.customer_id) returningIds.add(e.customer_id);
    }

    const bookingRows: ReportBookingRow[] = rows.slice(0, BOOKINGS_MAX).map((r) => ({
      id: r.id,
      queue_number: r.queue_number,
      booking_date: r.booking_date,
      start_time: hhmm(r.start_time),
      end_time: hhmm(r.end_time),
      status: r.status,
      customer_name: customerLabel(r.customers),
      customer_phone: r.customers?.phone ?? '',
      service_name: r.services?.service_name ?? '-',
      branch_name: r.branches?.branch_name ?? '-',
      resource_name: r.resource_name || '',
      note: r.note ?? '',
    }));

    if (query.mode === 'csv' && query.group === 'staff') {
      const lines = [['staff', 'total_bookings', 'completed', 'cancelled', 'no_show'].join(',')];
      byStaff.forEach((s) => lines.push([s.name, s.count, s.completed, s.cancelled, s.no_show].map(csvEscape).join(',')));
      return csvResponse(lines, `report-staff-${range.from}-to-${range.to}.csv`);
    }

    if (query.mode === 'csv' && query.group === 'bookings') {
      const lines = [['date', 'start_time', 'end_time', 'queue_number', 'customer', 'phone', 'service', 'branch', 'staff', 'status', 'note'].join(',')];
      bookingRows.forEach((b) =>
        lines.push([b.booking_date, b.start_time, b.end_time, b.queue_number, b.customer_name, b.customer_phone, b.service_name, b.branch_name, b.resource_name, b.status, b.note].map(csvEscape).join(',')),
      );
      return csvResponse(lines, `report-bookings-${range.from}-to-${range.to}.csv`);
    }

    if (query.mode === 'csv') {
      const lines = [['date', 'total_bookings', 'cancelled', 'no_show', 'completed'].join(',')];
      byDay.forEach((d) => lines.push([d.date, d.count, d.cancelled, d.no_show, d.completed].map(csvEscape).join(',')));
      return csvResponse(lines, `report-${range.from}-to-${range.to}.csv`);
    }

    const shop = shopRes.data as { name?: string | null; logo_url?: string | null } | null;
    const branch = branchRes.data as { branch_name?: string | null } | null;

    const data: ReportData = {
      range: { ...range, today },
      shop: { name: shop?.name ?? '', logo_url: shop?.logo_url ?? null },
      branch: { name: branch?.branch_name ?? null },
      kpi: {
        total,
        booked,
        completed,
        cancelled,
        no_show: noShow,
        cancel_rate: pct(cancelled + noShow, total),
        customers_new: customerIds.length - returningIds.size,
        customers_returning: returningIds.size,
      },
      prev,
      by_day: byDay,
      by_hour: byHour,
      by_status: byStatus,
      popular_services: named(serviceMap),
      by_branch: named(branchMap),
      by_staff: byStaff,
      bookings: { rows: bookingRows, total, truncated: total > BOOKINGS_MAX || listRes.truncated },
      generated_at: new Date().toISOString(),
    };

    return NextResponse.json({ data });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}
