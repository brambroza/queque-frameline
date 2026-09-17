import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { confirmOmiseCharge, omiseReceiptRef } from '@/lib/payments/omise-confirm';

interface OmiseWebhookEvent {
  object: string;
  key: string;
  data: {
    id: string;
    object: string;
    status?: string;
    amount?: number;
    currency?: string;
    paid_at?: string | null;
    metadata?: Record<string, string>;
  };
}

/**
 * Omise webhook for every Omise-backed method (PromptPay QR, Mobile Banking).
 *
 * The body is only used to find the booking; `confirmOmiseCharge` re-fetches
 * the charge with the shop's key before anything is marked paid.
 */
export async function POST(req: Request) {
  // Omise does not sign its webhooks, so a shared secret in the URL is the
  // cheapest way to stop this endpoint being an open oracle. Optional, so
  // existing deployments keep working until they add it to their webhook URL.
  const expectedSecret = process.env.OMISE_WEBHOOK_SECRET ?? '';
  if (expectedSecret) {
    const given = new URL(req.url).searchParams.get('key') ?? '';
    if (given !== expectedSecret) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  let event: OmiseWebhookEvent;
  try {
    event = (await req.json()) as OmiseWebhookEvent;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Only process charge.complete events
  if (event.key !== 'charge.complete') {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const chargeId = event.data?.id;
  if (!chargeId) {
    return NextResponse.json({ error: 'Missing charge id' }, { status: 400 });
  }

  const admin = createAdminClient();

  // Look up the booking by omise_charge_id
  const { data: booking, error: bookingErr } = await admin
    .from('bookings')
    .select('id, shop_id, payment_status')
    .eq('omise_charge_id', chargeId)
    .maybeSingle();

  if (bookingErr || !booking) {
    // Unknown charge (or one re-issued since) — acknowledge to prevent retries
    return NextResponse.json({ ok: true, skipped: 'booking_not_found' });
  }

  if (booking.payment_status === 'paid') {
    return NextResponse.json({ ok: true, skipped: 'already_paid' });
  }

  const outcome = await confirmOmiseCharge(admin, { shopId: booking.shop_id as string, bookingId: booking.id as string });

  // 502 only when Omise itself could not be reached, so Omise retries just that case.
  if (outcome === 'provider_error') {
    return NextResponse.json({ error: 'Omise verify failed' }, { status: 502 });
  }
  if (outcome === 'paid') {
    return NextResponse.json({ ok: true, receipt_ref: omiseReceiptRef(chargeId) });
  }
  return NextResponse.json({ ok: true, status: outcome });
}
