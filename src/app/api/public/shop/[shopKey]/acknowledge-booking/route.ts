import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveShopByKeyOrId } from '@/lib/line/shop-resolver';
import { acknowledgeBookingChange } from '@/lib/booking/acknowledge-change';

const schema = z.object({
  line_user_id: z.string().min(1),
  booking_id: z.string().uuid(),
});

/**
 * LIFF counterpart of the "รับทราบ" postback: the customer confirms they saw a
 * shop-initiated change from the account tab. Ownership is enforced inside
 * `acknowledgeBookingChange` (booking must belong to this LINE user).
 */
export async function POST(req: Request, { params }: { params: Promise<{ shopKey: string }> }) {
  const { shopKey } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  const payload = parsed.data;

  const admin = createAdminClient();
  const shop = await resolveShopByKeyOrId(admin, shopKey);
  if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 });

  const result = await acknowledgeBookingChange(admin, {
    shopId: shop.id,
    companyId: shop.company_id,
    externalLineUserId: payload.line_user_id,
    bookingId: payload.booking_id,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.reason === 'line_user_not_found' ? 'Line user not found' : 'Booking not found' }, { status: 404 });
  }
  return NextResponse.json({ data: { ok: true, already: result.already } });
}
