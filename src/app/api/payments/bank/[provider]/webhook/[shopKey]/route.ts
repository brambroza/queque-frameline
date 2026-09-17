import { timingSafeEqual } from 'crypto';
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveShopByKeyOrId } from '@/lib/line/shop-resolver';
import { confirmDeeplinkPayment } from '@/lib/payments/deeplink/confirm';
import { getDeeplinkAdapter, parseBankProvider } from '@/lib/payments/deeplink/registry';
import { loadShopDeeplinkProvider } from '@/lib/payments/deeplink/settings';

function secretMatches(given: string, expected: string) {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && a.length > 0 && timingSafeEqual(a, b);
}

/**
 * Bank payment confirmation callback.
 *
 * Neither SCB nor KBank signs these, so the URL carries a per-shop secret and
 * every failure to authenticate is a 404 (never confirm the endpoint exists).
 * The body is used only to find the booking — `confirmDeeplinkPayment`
 * re-asks the bank before anything is marked paid.
 */
export async function POST(req: Request, { params }: { params: Promise<{ provider: string; shopKey: string }> }) {
  const { provider: providerParam, shopKey } = await params;
  const provider = parseBankProvider(providerParam);
  if (!provider) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const admin = createAdminClient();
  const shop = await resolveShopByKeyOrId(admin, shopKey);
  if (!shop) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const config = await loadShopDeeplinkProvider(admin, shop.id, provider, { includeDisabled: true });
  if (!config) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const given = new URL(req.url).searchParams.get('key') ?? '';
  if (!secretMatches(given, config.webhookSecret)) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const adapter = getDeeplinkAdapter(provider);
  const payload = adapter.parseConfirmation(body);
  if (!payload) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

  // Locate the booking: bank transaction id first, our reference second.
  let bookingId: string | null = null;
  if (payload.transactionId) {
    const { data } = await admin
      .from('bookings')
      .select('id')
      .eq('shop_id', shop.id)
      .eq('bank_provider', provider)
      .eq('bank_txn_id', payload.transactionId)
      .maybeSingle();
    bookingId = data?.id ?? null;
  }
  if (!bookingId && payload.ref1) {
    const { data } = await admin
      .from('bookings')
      .select('id')
      .eq('shop_id', shop.id)
      .eq('bank_provider', provider)
      .eq('bank_txn_ref', payload.ref1.toUpperCase())
      .maybeSingle();
    bookingId = data?.id ?? null;
  }

  // Unknown transaction: acknowledge so the bank stops retrying.
  if (!bookingId) return NextResponse.json({ ...adapter.confirmationResponse(payload), skipped: 'booking_not_found' });

  const outcome = await confirmDeeplinkPayment(admin, { shopId: shop.id, bookingId });
  // Only an upstream failure deserves a retry from the bank.
  if (outcome === 'provider_error') return NextResponse.json({ error: 'Verification unavailable' }, { status: 502 });

  return NextResponse.json({ ...adapter.confirmationResponse(payload), outcome });
}
