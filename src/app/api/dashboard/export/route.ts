import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuthContext, getErrorStatus } from '@/lib/auth/context';
import { applyBranchScope } from '@/lib/auth/branch-scope';
import { formatDateTimeDMY, getTodayISOInBangkok } from '@/lib/utils/date-format';
import { resolveRange } from '@/lib/dashboard/date-range';
import { fetchAllPages } from '@/lib/dashboard/fetch-all';
import { customerLabel } from '@/lib/booking/customer-label';
import { closedMinutes } from '@/lib/dashboard/queue-duration';
import { resolveBranchSelection } from '@/lib/dashboard/branch-selection';
import type { DashboardExportBooking } from '@/lib/dashboard/export';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const QuerySchema = z.object({
  range: z.enum(['today', 'week', 'month', 'custom']).default('today'),
  from: z.string().regex(ISO_DATE).optional(),
  to: z.string().regex(ISO_DATE).optional(),
  branch_id: z.string().uuid().optional(),
  /** Several branches at once, comma separated. */
  branch_ids: z.string().regex(/^[0-9a-fA-F-]{36}(,[0-9a-fA-F-]{36}){0,49}$/).optional(),
  direction: z.enum(['inbound', 'outbound']).optional(),
});

/** Pages of 1000 rows fetched per export; larger ranges are truncated and flagged. */
const EXPORT_MAX_PAGES = 10;

type ExportRow = {
  booking_date: string;
  start_time: string;
  queue_number: string | null;
  direction: string | null;
  resource_name: string | null;
  plate_number: string | null;
  do_number: string | null;
  status: string;
  created_at: string;
  called_at: string | null;
  completed_at: string | null;
  call_count: number | null;
  services: { service_name?: string } | null;
  branches: { branch_name?: string } | null;
  customers: { full_name?: string | null; nickname?: string | null } | null;
};

/**
 * Booking list behind the dashboard export: every queue whose booking date is
 * inside the selected range (same range + branch rules as `/api/dashboard`),
 * not just the page shown in "recent bookings".
 */
export async function GET(req: Request) {
  try {
    const { supabase, profile, user, capabilities } = await requireAuthContext({ roles: ['admin', 'staff', 'viewer'] });
    if (!capabilities.canExport) return NextResponse.json({ error: 'สิทธิ์ของคุณส่งออกข้อมูลไม่ได้', code: 'EXPORT_FORBIDDEN' }, { status: 403 });
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
    if (!targetShopId) return NextResponse.json({ error: 'Select a shop first', code: 'SHOP_REQUIRED' }, { status: 400 });

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

    let range;
    try {
      range = resolveRange(query.range, getTodayISOInBangkok(), query.from, query.to);
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : 'Invalid range' }, { status: 400 });
    }

    /** Narrow the query to the requested direction, when one was asked for. */
    const byDirection = <Q,>(q: Q): Q => (query.direction ? ((q as unknown as { eq: (c: string, v: string) => Q }).eq('direction', query.direction)) : q);

    const res = await fetchAllPages<ExportRow>(
      (from, to) =>
        applyBranchScope(
          byDirection(supabase
            .from('bookings')
            .select('booking_date,start_time,queue_number,direction,resource_name,plate_number,do_number,status,created_at,called_at,completed_at,call_count,services(service_name),branches(branch_name),customers(full_name,nickname)')
            .eq('shop_id', targetShopId)
            .eq('is_deleted', false)
            .gte('booking_date', range.from)
            .lte('booking_date', range.to)),
          branchScope,
          requestedBranchId,
        )
          .order('booking_date', { ascending: true })
          .order('start_time', { ascending: true })
          .order('id', { ascending: true })
          .range(from, to) as unknown as PromiseLike<{ data: ExportRow[] | null; error: unknown }>,
      { maxPages: EXPORT_MAX_PAGES },
    );
    if (res.error) throw res.error;

    const rows: DashboardExportBooking[] = res.data.map((b) => ({
      booking_date: b.booking_date,
      start_time: String(b.start_time).slice(0, 5),
      queue_number: b.queue_number ?? '',
      direction: b.direction ?? '',
      customer_name: customerLabel(b.customers),
      service_name: b.services?.service_name ?? '',
      branch_name: b.branches?.branch_name ?? '',
      resource_name: b.resource_name ?? '',
      plate_number: b.plate_number ?? '',
      do_number: b.do_number ?? '',
      status: b.status,
      created_at: formatDateTimeDMY(b.created_at),
      called_at: b.called_at ? formatDateTimeDMY(b.called_at) : '',
      completed_at: b.completed_at ? formatDateTimeDMY(b.completed_at) : '',
      call_count: b.call_count ?? 0,
      queue_minutes: closedMinutes(b),
    }));

    return NextResponse.json({ data: { rows, truncated: res.truncated, from: range.from, to: range.to } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}
