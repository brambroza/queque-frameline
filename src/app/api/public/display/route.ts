import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { toBangkokStamp } from '@/lib/booking/slot-time';
import { displayPlate } from '@/lib/display/format';
import { pickDisplayBranch, type DisplayBranch } from '@/lib/display/branch';

export const dynamic = 'force-dynamic';

/** Optional shared key (`DISPLAY_KEY`): when set, the TV URL must carry `?key=`. */
function keyOk(req: Request): boolean {
  const want = process.env.DISPLAY_KEY;
  if (!want) return true;
  const got = Buffer.from(new URL(req.url).searchParams.get('key') ?? '');
  const expected = Buffer.from(want);
  return got.length === expected.length && timingSafeEqual(got, expected);
}

/** One embedded row (`services`, `customers`, `external_documents`) as PostgREST returns it. */
function one<T>(v: T | T[] | null | undefined): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : (v ?? null);
}

/**
 * Yard TV feed: per dock who is being called / served, plus the waiting line.
 * One branch per screen (`?branch=<code|id>`); `?branch=all` puts every branch
 * on one screen, and a multi-branch site without the parameter gets the branch
 * list (`mode: 'choose'`) instead of a mixed queue.
 * Exposes queue number, plate (laid out per vehicle type), vehicle type, time,
 * SO/PO number, customer/partner name, driver name, dock and DO number.
 * Phone numbers are never included — the page is public.
 */
export async function GET(req: Request) {
  if (!keyOk(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const admin = createAdminClient();
    const { data: shop } = await admin.from('shops').select('id,name,logo_url').eq('shop_key', process.env.SITE_SHOP_KEY || 'fameline').eq('is_deleted', false).maybeSingle();
    if (!shop) return NextResponse.json({ error: 'site not found' }, { status: 404 });
    const today = toBangkokStamp(new Date()).date;

    // Which branch this TV shows: `?branch=<code|id>`, `?branch=all`, or none (see `pickDisplayBranch`).
    const { data: branchRows, error: branchError } = await admin.from('branches').select('id,code,branch_name').eq('shop_id', shop.id).eq('active', true).eq('is_deleted', false).order('branch_name', { ascending: true });
    if (branchError) throw branchError;
    const branches: DisplayBranch[] = (branchRows ?? []).map((b) => ({ id: b.id, code: b.code ?? null, name: b.branch_name }));
    const pick = pickDisplayBranch(branches, new URL(req.url).searchParams.get('branch'));
    if (pick.kind === 'not_found') return NextResponse.json({ error: 'branch not found' }, { status: 404 });

    const site = { name: shop.name, logo_url: shop.logo_url };
    const server_time = new Date().toISOString();
    if (pick.kind === 'choose') {
      return NextResponse.json({ data: { site, today, server_time, mode: 'choose', branch: null, branches, docks: [], waiting: [] } });
    }
    const branchId = pick.kind === 'branch' ? pick.branch.id : null;

    const dockBase = admin.from('booking_resources').select('id,resource_code,resource_name,direction,branch_id').eq('shop_id', shop.id).eq('resource_type', 'dock').eq('active', true).eq('is_deleted', false);
    const rowBase = admin
      .from('bookings')
      .select('id,queue_number,status,direction,start_time,resource_id,plate_number,plate_number_actual,do_number,called_at,call_count,driver_name,services(service_name,plate_format),customers(full_name),external_documents(doc_no,doc_type,partner_name)')
      .eq('shop_id', shop.id)
      .eq('booking_date', today)
      .eq('is_deleted', false)
      .in('status', ['checked_in', 'called', 'serving']);
    const [{ data: docks, error: dockError }, { data: rows, error: rowError }] = await Promise.all([
      (branchId ? dockBase.eq('branch_id', branchId) : dockBase).order('resource_code', { ascending: true }),
      (branchId ? rowBase.eq('branch_id', branchId) : rowBase).order('start_time', { ascending: true }),
    ]);
    if (dockError) throw dockError;
    if (rowError) throw rowError;

    const slim = (b: NonNullable<typeof rows>[number]) => {
      const service = one(b.services);
      const doc = one(b.external_documents);
      const customer = one(b.customers);
      return {
        id: b.id, queue_number: b.queue_number, status: b.status, direction: b.direction, start_time: b.start_time,
        plate: displayPlate(b, service?.plate_format), do_number: b.do_number, called_at: b.called_at, call_count: b.call_count, dock_id: b.resource_id,
        service_name: service?.service_name ?? null,
        doc_no: doc?.doc_no ?? null,
        doc_type: doc?.doc_type ?? null,
        customer_name: customer?.full_name || doc?.partner_name || null,
        driver_name: b.driver_name || null,
      };
    };
    const live = rows ?? [];
    // Combined screen: keep each branch's docks together, in branch-name order.
    const branchOrder = new Map(branches.map((b, i) => [b.id, i]));
    const rank = (id: string | null) => branchOrder.get(id ?? '') ?? branches.length;
    const orderedDocks = branchId ? (docks ?? []) : [...(docks ?? [])].sort((a, b) => rank(a.branch_id) - rank(b.branch_id));
    return NextResponse.json({
      data: {
        site,
        today,
        server_time,
        mode: pick.kind,
        branch: pick.kind === 'branch' ? pick.branch : null,
        branches,
        docks: orderedDocks.map((d) => ({
          id: d.id, code: d.resource_code, name: d.resource_name, direction: d.direction,
          branch_name: branches.find((b) => b.id === d.branch_id)?.name ?? null,
          current: live.filter((b) => b.resource_id === d.id && (b.status === 'called' || b.status === 'serving')).map(slim)[0] ?? null,
        })),
        waiting: live.filter((b) => b.status === 'checked_in').map(slim),
      },
    });
  } catch (e) {
    console.error('[public/display]', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'display feed failed' }, { status: 500 });
  }
}
