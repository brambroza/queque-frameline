import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { toBangkokStamp } from '@/lib/booking/slot-time';
import { displayPlate } from '@/lib/display/format';

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

    const [{ data: docks }, { data: rows }] = await Promise.all([
      admin.from('booking_resources').select('id,resource_code,resource_name,direction').eq('shop_id', shop.id).eq('resource_type', 'dock').eq('active', true).eq('is_deleted', false).order('resource_code', { ascending: true }),
      admin
        .from('bookings')
        .select('id,queue_number,status,direction,start_time,resource_id,plate_number,plate_number_actual,do_number,called_at,call_count,driver_name,services(service_name,plate_format),customers(full_name),external_documents(doc_no,doc_type,partner_name)')
        .eq('shop_id', shop.id)
        .eq('booking_date', today)
        .eq('is_deleted', false)
        .in('status', ['checked_in', 'called', 'serving'])
        .order('start_time', { ascending: true }),
    ]);

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
    return NextResponse.json({
      data: {
        site: { name: shop.name, logo_url: shop.logo_url },
        today,
        server_time: new Date().toISOString(),
        docks: (docks ?? []).map((d) => ({
          id: d.id, code: d.resource_code, name: d.resource_name, direction: d.direction,
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
