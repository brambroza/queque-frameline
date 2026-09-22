import { NextResponse } from 'next/server';
import { requireAuthContext, getErrorStatus } from '@/lib/auth/context';
import { DOCK_RELEASED_STATUSES, type DockDayResponse } from '@/lib/booking/dock-day';
import { toBangkokStamp } from '@/lib/booking/slot-time';

type OtherRow = {
  id: string;
  queue_number: string;
  start_time: string;
  end_time: string | null;
  buffer_minutes: number | null;
  status: string;
  customers: { full_name: string | null } | { full_name: string | null }[] | null;
};

type HoursRow = { open_time: string; close_time: string; break_start: string | null; break_end: string | null; branch_id: string | null; direction: string | null };

/**
 * The dock's day around one queue: every other live queue on that dock and the
 * working hours, so the approve / adjust dialogs can show how far the stay can
 * stretch before it hits the next queue. Read-only; the RPCs stay the authority.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { supabase, profile } = await requireAuthContext({ roles: ['admin', 'staff'] });
    const { id } = await ctx.params;

    const { data: b } = await supabase
      .from('bookings')
      .select('id,booking_date,start_time,end_time,buffer_minutes,resource_id,resource_name,branch_id,direction')
      .eq('id', id)
      .eq('shop_id', profile.shop_id)
      .eq('is_deleted', false)
      .maybeSingle();
    if (!b) return NextResponse.json({ error: 'ไม่พบคิว' }, { status: 404 });

    const now = toBangkokStamp(new Date());
    const self = { start_time: b.start_time, end_time: b.end_time, buffer_minutes: b.buffer_minutes };
    if (!b.resource_id) {
      const empty: DockDayResponse = { dock: null, date: b.booking_date, self, others: [], hours: null, now };
      return NextResponse.json({ data: empty });
    }

    const [{ data: others, error: othersError }, { data: hoursRows, error: hoursError }] = await Promise.all([
      supabase
        .from('bookings')
        .select('id,queue_number,start_time,end_time,buffer_minutes,status,customers(full_name)')
        .eq('shop_id', profile.shop_id)
        .eq('resource_id', b.resource_id)
        .eq('booking_date', b.booking_date)
        .eq('is_deleted', false)
        .neq('id', b.id)
        .not('status', 'in', `(${DOCK_RELEASED_STATUSES.join(',')})`)
        .order('start_time'),
      supabase
        .from('working_hours')
        .select('open_time,close_time,break_start,break_end,branch_id,direction')
        .eq('shop_id', profile.shop_id)
        .eq('weekday', weekdayOf(b.booking_date))
        .eq('active', true)
        .eq('is_deleted', false)
        .or(b.branch_id ? `branch_id.eq.${b.branch_id},branch_id.is.null` : 'branch_id.is.null')
        .or(`direction.is.null,direction.eq.${b.direction}`),
    ]);
    if (othersError) throw othersError;
    if (hoursError) throw hoursError;

    // Same precedence as get_dock_slots: a direction-specific row beats a shared one, then the branch's own row.
    const hours = ((hoursRows ?? []) as HoursRow[])
      .sort((x, y) => Number(y.direction !== null) - Number(x.direction !== null) || Number(y.branch_id === b.branch_id) - Number(x.branch_id === b.branch_id))[0] ?? null;

    const data: DockDayResponse = {
      dock: { id: b.resource_id, name: b.resource_name ?? null },
      date: b.booking_date,
      self,
      others: ((others ?? []) as OtherRow[]).map((o) => ({
        id: o.id,
        queue_number: o.queue_number,
        start_time: o.start_time,
        end_time: o.end_time,
        buffer_minutes: o.buffer_minutes,
        status: o.status,
        customer_name: (Array.isArray(o.customers) ? o.customers[0] : o.customers)?.full_name ?? null,
      })),
      hours: hours ? { open_time: hours.open_time, close_time: hours.close_time, break_start: hours.break_start, break_end: hours.break_end } : null,
      now,
    };
    return NextResponse.json({ data });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}

/** Postgres `extract(dow)` of an ISO date (0 = Sunday), without timezone drift. */
function weekdayOf(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}
