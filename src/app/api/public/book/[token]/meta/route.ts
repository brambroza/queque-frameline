import { NextResponse } from 'next/server';
import { isPaymentCleared, paymentApplies } from '@/lib/booking/payment';
import { createAdminClient } from '@/lib/supabase/admin';
import { PUBLIC_BOOKING_SELECT, resolveBookingToken } from '@/lib/public/resolve';
import { getSiteSettings } from '@/lib/booking/server';
import { toBangkokStamp } from '@/lib/booking/slot-time';
import { CUSTOMER_CANCELLABLE_STATUSES } from '@/lib/booking/status-flow';
import { deriveLinkToken } from '@/lib/tokens';
import { driverUrl } from '@/lib/links';
import { addFriendUrl, getLineConfig } from '@/lib/line/config';

/** Everything the self-booking page needs: the document, vehicle types, rules and this document's queues. */
export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await ctx.params;
    const admin = createAdminClient();
    const resolved = await resolveBookingToken(admin, token);
    if (!resolved.ok) return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    const { doc } = resolved;
    const direction = doc.doc_type === 'so' ? 'outbound' : 'inbound';

    const [{ data: shop }, { data: branch }, settings, { data: vehicles }, { data: bookings }, line, { data: partner }] = await Promise.all([
      admin.from('shops').select('name,phone,address,logo_url').eq('id', doc.shop_id).maybeSingle(),
      doc.branch_id ? admin.from('branches').select('branch_name,address,phone').eq('id', doc.branch_id).eq('shop_id', doc.shop_id).maybeSingle() : Promise.resolve({ data: null as { branch_name: string; address: string | null; phone: string | null } | null }),
      getSiteSettings(admin, doc.shop_id),
      admin
        .from('services')
        .select('id,service_name,duration_minutes,direction,plate_format')
        .eq('shop_id', doc.shop_id)
        .eq('active', true)
        .eq('is_deleted', false)
        .or(`direction.is.null,direction.eq.${direction}`)
        .order('sort_order', { ascending: true }),
      admin.from('bookings').select(`${PUBLIC_BOOKING_SELECT},driver_token_hash`).eq('shop_id', doc.shop_id).eq('document_id', doc.id).eq('is_deleted', false).order('created_at', { ascending: true }),
      getLineConfig(admin, doc.shop_id),
      doc.partner_id ? admin.from('customers').select('line_users(display_name)').eq('id', doc.partner_id).eq('shop_id', doc.shop_id).maybeSingle() : Promise.resolve({ data: null as unknown }),
    ]);
    const linkedName = ((partner as { line_users?: { display_name?: string | null } | null } | null)?.line_users?.display_name) ?? null;

    return NextResponse.json({
      data: {
        site: {
          name: shop?.name ?? 'Fameline',
          branch: branch?.branch_name ?? null,
          phone: branch?.phone ?? shop?.phone ?? null,
          address: branch?.address ?? shop?.address ?? null,
          logo_url: shop?.logo_url ?? null,
        },
        document: { doc_no: doc.doc_no, doc_type: doc.doc_type, status: doc.status, partner_name: doc.partner_name, due_date: doc.due_date, remark: doc.remark, items: doc.items ?? [] },
        // Customers only learn whether payment is still awaited — never the reference or the note.
        payment: { required: paymentApplies(doc.doc_type), pending: !isPaymentCleared(doc.doc_type, doc.payment_status) },
        direction,
        open: doc.status === 'open' || doc.status === 'booked',
        vehicle_types: vehicles ?? [],
        rules: {
          lead_hours: settings.booking_lead_min_hours,
          horizon_days: settings.booking_horizon_days,
          require_admin_confirm: settings.require_admin_confirm,
          grace_minutes: settings.grace_minutes,
          early_arrival_minutes: settings.early_arrival_minutes,
        },
        today: toBangkokStamp(new Date()).date,
        line: { liff_id: line.liff_id, add_friend_url: addFriendUrl(line), linked_name: linkedName, enabled: Boolean(line.channel_access_token && line.liff_id && line.login_channel_id) },
        bookings: ((bookings ?? []) as unknown as Array<Record<string, unknown>>).map(({ driver_token_version, driver_token_hash, ...b }) => ({
          ...b,
          cancellable: (CUSTOMER_CANCELLABLE_STATUSES as readonly string[]).includes(String(b.status)),
          // The customer forwards this to their driver once the queue is confirmed.
          driver_url: b.do_number && driver_token_hash ? driverUrl(deriveLinkToken('driver', String(b.id), Number(driver_token_version ?? 0))) : null,
        })),
      },
    });
  } catch (e) {
    console.error('[public/book/meta]', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาด กรุณาลองใหม่' }, { status: 500 });
  }
}
