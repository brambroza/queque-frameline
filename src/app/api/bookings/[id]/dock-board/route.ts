import { NextResponse } from 'next/server';
import { requireAuthContext, getErrorStatus } from '@/lib/auth/context';
import { DOCK_RELEASED_STATUSES, type DockBoardLane, type DockBoardResponse, type DockDayOther } from '@/lib/booking/dock-day';
import { isoDateSchema } from '@/lib/booking/schemas';
import { decorateSlots, toBangkokStamp, type SlotRow } from '@/lib/booking/slot-time';

type DockRow = { id: string; resource_name: string; resource_code: string | null; branch_id: string | null; direction: string | null; service_ids: string[] | null };

type OtherRow = {
  id: string;
  queue_number: string;
  start_time: string;
  end_time: string | null;
  buffer_minutes: number | null;
  status: string;
  resource_id: string | null;
  customers: { full_name: string | null } | { full_name: string | null }[] | null;
};

type HoursRow = { open_time: string; close_time: string; break_start: string | null; break_end: string | null; branch_id: string | null; direction: string | null };

/**
 * Every dock this queue may sit on, with that day's other queues and the slot
 * starts `move_dock_booking` would accept on each — the scheduling dialog's
 * board. `?date=` looks at another day. Read-only; the RPC stays the authority.
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { supabase, profile } = await requireAuthContext({ roles: ['admin', 'staff'] });
    const { id } = await ctx.params;
    const dateParam = new URL(req.url).searchParams.get('date');
    const dateParsed = dateParam ? isoDateSchema.safeParse(dateParam) : null;
    if (dateParsed && !dateParsed.success) return NextResponse.json({ error: 'วันที่ไม่ถูกต้อง' }, { status: 400 });

    const { data: b } = await supabase
      .from('bookings')
      .select('id,booking_date,start_time,end_time,service_minutes,buffer_minutes,resource_id,branch_id,direction,service_id')
      .eq('id', id)
      .eq('shop_id', profile.shop_id)
      .eq('is_deleted', false)
      .maybeSingle();
    if (!b) return NextResponse.json({ error: 'ไม่พบคิว' }, { status: 404 });

    const date: string = dateParsed?.success ? dateParsed.data : b.booking_date;
    const now = new Date();

    // Same rule as `eligible_docks`, evaluated here because `service_ids` is an array filter.
    const { data: dockRows, error: dockError } = await supabase
      .from('booking_resources')
      .select('id,resource_name,resource_code,branch_id,direction,service_ids')
      .eq('shop_id', profile.shop_id)
      .eq('resource_type', 'dock')
      .eq('active', true)
      .eq('is_deleted', false)
      .order('resource_code', { ascending: true, nullsFirst: false })
      .order('resource_name');
    if (dockError) throw dockError;
    const docks = ((dockRows ?? []) as DockRow[]).filter(
      (d) =>
        (!d.branch_id || !b.branch_id || d.branch_id === b.branch_id) &&
        (!d.direction || d.direction === b.direction) &&
        (!d.service_ids || d.service_ids.length === 0 || (b.service_id ? d.service_ids.includes(b.service_id) : true)),
    );
    const dockIds = docks.map((d) => d.id);

    const [{ data: others, error: othersError }, { data: hoursRows, error: hoursError }, slotsPerDock] = await Promise.all([
      dockIds.length
        ? supabase
            .from('bookings')
            .select('id,queue_number,start_time,end_time,buffer_minutes,status,resource_id,customers(full_name)')
            .eq('shop_id', profile.shop_id)
            .eq('booking_date', date)
            .eq('is_deleted', false)
            .neq('id', b.id)
            .in('resource_id', dockIds)
            .not('status', 'in', `(${DOCK_RELEASED_STATUSES.join(',')})`)
            .order('start_time')
        : Promise.resolve({ data: [] as OtherRow[], error: null }),
      supabase
        .from('working_hours')
        .select('open_time,close_time,break_start,break_end,branch_id,direction')
        .eq('shop_id', profile.shop_id)
        .eq('weekday', weekdayOf(date))
        .eq('active', true)
        .eq('is_deleted', false)
        .or(b.branch_id ? `branch_id.eq.${b.branch_id},branch_id.is.null` : 'branch_id.is.null')
        .or(`direction.is.null,direction.eq.${b.direction}`),
      Promise.all(
        docks.map(async (d) => {
          // No vehicle type = the slot grid cannot be computed = nowhere to move to.
          if (!b.service_id) return [] as string[];
          const { data, error } = await supabase.rpc('get_dock_slots', {
            p_shop_id: profile.shop_id,
            p_branch_id: b.branch_id,
            p_direction: b.direction,
            p_service_id: b.service_id,
            p_date: date,
            p_resource_id: d.id,
            p_exclude_booking_id: b.id,
          });
          if (error) throw error;
          return decorateSlots(date, (data ?? []) as SlotRow[], now, 0)
            .filter((s) => s.bookable)
            .map((s) => s.slot_time);
        }),
      ),
    ]);
    if (othersError) throw othersError;
    if (hoursError) throw hoursError;

    const othersByDock = new Map<string, DockDayOther[]>();
    for (const o of (others ?? []) as OtherRow[]) {
      if (!o.resource_id) continue;
      const list = othersByDock.get(o.resource_id) ?? [];
      list.push({
        id: o.id,
        queue_number: o.queue_number,
        start_time: o.start_time,
        end_time: o.end_time,
        buffer_minutes: o.buffer_minutes,
        status: o.status,
        customer_name: (Array.isArray(o.customers) ? o.customers[0] : o.customers)?.full_name ?? null,
      });
      othersByDock.set(o.resource_id, list);
    }

    // Same precedence as get_dock_slots: a direction-specific row beats a shared one, then the branch's own row.
    const hours = ((hoursRows ?? []) as HoursRow[])
      .sort((x, y) => Number(y.direction !== null) - Number(x.direction !== null) || Number(y.branch_id === b.branch_id) - Number(x.branch_id === b.branch_id))[0] ?? null;

    const lanes: DockBoardLane[] = docks.map((d, i) => ({
      id: d.id,
      name: d.resource_name,
      code: d.resource_code,
      others: othersByDock.get(d.id) ?? [],
      slotStarts: slotsPerDock[i],
    }));

    const data: DockBoardResponse = {
      date,
      self: { booking_date: b.booking_date, start_time: b.start_time, end_time: b.end_time, service_minutes: b.service_minutes, buffer_minutes: b.buffer_minutes, resource_id: b.resource_id },
      docks: lanes,
      hours: hours ? { open_time: hours.open_time, close_time: hours.close_time, break_start: hours.break_start, break_end: hours.break_end } : null,
      now: toBangkokStamp(now),
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
