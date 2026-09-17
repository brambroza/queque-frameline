import { createAdminClient } from '@/lib/supabase/admin';
import { resolveOmiseSecretKey } from '@/lib/payments/omise';
import { Resvg } from '@resvg/resvg-js';

/**
 * Public proxy — ดึง QR image จาก Omise แล้วแปลง SVG → PNG ก่อนส่งกลับ
 * LINE Flex Message ต้องการ PNG/JPEG เท่านั้น (ไม่รองรับ SVG)
 * GET /api/payments/qr-image?booking_id=xxx
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const bookingId = searchParams.get('booking_id');
  if (!bookingId) {
    return new Response('Missing booking_id', { status: 400 });
  }

  const admin = createAdminClient();
  const { data: booking } = await admin
    .from('bookings')
    .select('omise_charge_id, omise_qr_image_url, payment_status, shops(omise_secret_key)')
    .eq('id', bookingId)
    .maybeSingle();

  if (!booking?.omise_charge_id) {
    return new Response('Not found', { status: 404 });
  }

  const downloadUri = booking.omise_qr_image_url;
  if (!downloadUri) {
    return new Response('QR not available', { status: 404 });
  }

  const shop = booking.shops as unknown as { omise_secret_key?: string | null } | null;
  const secretKey = resolveOmiseSecretKey(shop?.omise_secret_key);

  const omiseRes = await fetch(downloadUri, {
    headers: { Authorization: 'Basic ' + Buffer.from(`${secretKey}:`).toString('base64') },
  });

  if (!omiseRes.ok) {
    return new Response('Failed to fetch QR from Omise', { status: 502 });
  }

  const rawBuffer = Buffer.from(await omiseRes.arrayBuffer());
  const contentType = omiseRes.headers.get('content-type') ?? '';

  // Omise returns SVG — convert to PNG so LINE can render it
  let pngBytes: Uint8Array;
  const isSvg = contentType.includes('svg')
    || rawBuffer.subarray(0, 5).toString() === '<?xml'
    || rawBuffer.subarray(0, 4).toString() === '<svg';

  if (isSvg) {
    const resvg = new Resvg(rawBuffer, {
      fitTo: { mode: 'width', value: 512 },
      background: 'white',
    });
    pngBytes = resvg.render().asPng();
  } else {
    pngBytes = new Uint8Array(rawBuffer);
  }

  return new Response(pngBytes.buffer.slice(pngBytes.byteOffset, pngBytes.byteOffset + pngBytes.byteLength) as ArrayBuffer, {
    status: 200,
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
