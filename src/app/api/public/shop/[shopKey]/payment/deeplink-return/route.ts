import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveShopByKeyOrId } from '@/lib/line/shop-resolver';
import { verifyBookingToken } from '@/lib/payments/tokens';
import { confirmDeeplinkPayment } from '@/lib/payments/deeplink/confirm';
import { confirmOmiseCharge } from '@/lib/payments/omise-confirm';
import { parseBankProvider, providerDisplayName } from '@/lib/payments/deeplink/registry';
import { bankDisplayName, isBankAppMethod, parseBankCode } from '@/lib/payments/mobile-banking/banks';

const querySchema = z.object({
  booking_id: z.string().uuid(),
  t: z.string().min(1),
});

/**
 * Status for the page the bank app returns the customer to, for both bank-app
 * methods (direct bank deeplink and Omise Mobile Banking).
 *
 * That page runs in the system browser, outside LIFF, so there is no LINE
 * identity — the HMAC token minted into the return URL is the only proof. It
 * therefore fails closed when PAYMENT_LINK_SECRET is unset and returns no PII.
 */
export async function GET(req: Request, { params }: { params: Promise<{ shopKey: string }> }) {
  if (!process.env.PAYMENT_LINK_SECRET) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { shopKey } = await params;
  const url = new URL(req.url);
  const parsed = querySchema.safeParse({ booking_id: url.searchParams.get('booking_id'), t: url.searchParams.get('t') });
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  if (!verifyBookingToken(parsed.data.booking_id, parsed.data.t)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const admin = createAdminClient();
  const shop = await resolveShopByKeyOrId(admin, shopKey);
  if (!shop) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const select = () =>
    admin
      .from('bookings')
      .select('id, queue_number, payment_status, payment_method, payment_amount, payment_expires_at, bank_provider, bank_txn_id, bank_deeplink_url, omise_charge_id')
      .eq('id', parsed.data.booking_id)
      .eq('shop_id', shop.id)
      .eq('is_deleted', false)
      .maybeSingle();

  let { data: booking } = await select();
  if (!booking || !isBankAppMethod(booking.payment_method)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  let outcome: string | null = null;
  if (booking.payment_status === 'pending_payment') {
    if (booking.payment_method === 'bank_deeplink' && booking.bank_txn_id) {
      outcome = await confirmDeeplinkPayment(admin, { shopId: shop.id, bookingId: booking.id });
    } else if (booking.payment_method === 'omise_mobile_banking' && booking.omise_charge_id) {
      outcome = await confirmOmiseCharge(admin, { shopId: shop.id, bookingId: booking.id });
    }
    if (outcome === 'paid' || outcome === 'already_paid' || outcome === 'failed') {
      booking = (await select()).data ?? booking;
    }
  }

  let provider: string | null = null;
  let providerName: string | null = null;
  if (booking.payment_method === 'bank_deeplink') {
    const p = parseBankProvider(booking.bank_provider);
    provider = p;
    providerName = p ? providerDisplayName(p) : null;
  } else {
    const code = parseBankCode(booking.bank_provider);
    provider = code;
    providerName = code ? bankDisplayName(code) : null;
  }

  return NextResponse.json({
    data: {
      queue_number: booking.queue_number,
      payment_status: booking.payment_status,
      payment_amount: booking.payment_amount,
      payment_expires_at: booking.payment_expires_at,
      provider,
      provider_name: providerName,
      // Lets the page relaunch the bank app when the Flex button had to route here.
      deeplink_url: booking.payment_status === 'pending_payment' ? booking.bank_deeplink_url : null,
      shop: { name: shop.name, shop_key: shop.shop_key, liff_id: shop.liff_id, liff_id_login_shop: shop.liff_id_login_shop },
      last_check: outcome,
    },
  });
}
