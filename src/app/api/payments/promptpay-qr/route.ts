import QRCode from 'qrcode';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAuthContext, getErrorStatus } from '@/lib/auth/context';
import { buildPromptPayPayload } from '@/lib/payments/promptpay';
import { getShopPaymentConfig } from '@/lib/payments/settings';
import { verifyBookingToken } from '@/lib/payments/tokens';

/**
 * Renders a shop's own PromptPay QR as a PNG.
 *
 * It has to be a URL rather than a data URI because LINE's servers fetch Flex
 * `image` components themselves, so the response cannot be cookie-authenticated.
 * An HMAC token stands in for that on the public mode.
 *
 * GET /api/payments/promptpay-qr?booking_id=<uuid>&t=<hmac>   — public, per booking
 * GET /api/payments/promptpay-qr?preview=1&amount=<n>         — portal settings preview
 */

/** Statuses where showing the customer a payable QR still makes sense. */
const PAYABLE_STATUSES = new Set(['pending_payment', 'awaiting_verification', 'rejected']);

async function renderPng(payload: string) {
  const buffer = await QRCode.toBuffer(payload, {
    type: 'png',
    width: 512,
    margin: 1,
    errorCorrectionLevel: 'M',
  });
  return new Uint8Array(buffer);
}

function pngResponse(bytes: Uint8Array, cacheControl: string) {
  const body = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  return new Response(body, {
    status: 200,
    headers: { 'Content-Type': 'image/png', 'Cache-Control': cacheControl },
  });
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  // ── Portal preview: authenticated, renders from the caller's own shop ──
  if (searchParams.get('preview')) {
    try {
      const { profile } = await requireAuthContext({ roles: ['super_admin', 'shop_owner'] });
      const admin = createAdminClient();
      const config = await getShopPaymentConfig(admin, profile.shop_id);
      if (!config.promptpayId) return new Response('PromptPay ID not configured', { status: 404 });

      const amount = Number(searchParams.get('amount') ?? 0);
      const payload = buildPromptPayPayload({
        target: config.promptpayId,
        amountTHB: Number.isFinite(amount) && amount > 0 ? amount : undefined,
      });
      return pngResponse(await renderPng(payload), 'no-store');
    } catch (e) {
      return new Response('Unauthorized', { status: getErrorStatus(e) });
    }
  }

  // ── Public: one booking's QR ──
  const bookingId = searchParams.get('booking_id');
  if (!bookingId) return new Response('Missing booking_id', { status: 400 });
  if (!verifyBookingToken(bookingId, searchParams.get('t'))) {
    return new Response('Not found', { status: 404 });
  }

  const admin = createAdminClient();
  const { data: booking } = await admin
    .from('bookings')
    .select('id, shop_id, payment_status, payment_method, payment_amount')
    .eq('id', bookingId)
    .maybeSingle();

  // Deliberately a flat 404 for every failure mode below — a distinguishable
  // error would turn this into an oracle for which booking ids exist.
  if (
    !booking ||
    booking.payment_method !== 'bank_transfer' ||
    !PAYABLE_STATUSES.has(String(booking.payment_status))
  ) {
    return new Response('Not found', { status: 404 });
  }

  const config = await getShopPaymentConfig(admin, booking.shop_id);
  if (!config.promptpayId) return new Response('Not found', { status: 404 });

  const amount = Number(booking.payment_amount ?? 0);
  let payload: string;
  try {
    payload = buildPromptPayPayload({
      target: config.promptpayId,
      amountTHB: amount > 0 ? amount : undefined,
    });
  } catch {
    return new Response('Not found', { status: 404 });
  }

  // `private` on purpose: this is a per-customer artefact and must never be
  // served out of a shared CDN cache to a different viewer.
  return pngResponse(await renderPng(payload), 'private, max-age=900');
}
