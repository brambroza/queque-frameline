import { NextResponse } from 'next/server';
import { createPromptPayCharge, resolveOmiseSecretKey, isTestKey } from '@/lib/payments/omise';

/**
 * DEV-ONLY endpoint — สร้าง PromptPay QR charge จาก Omise โดยตรง ไม่ผ่าน booking flow
 * ใช้ทดสอบว่า key ถูกต้องและ Omise API ตอบสนอง
 *
 * GET /api/payments/test-qr?amount=100
 *
 * ต้องตั้ง OMISE_SECRET_KEY=skey_test_xxx ใน .env.local
 * ลบ endpoint นี้ก่อน go-live production
 */
export async function GET(req: Request) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const amountTHB = Math.max(Number(searchParams.get('amount') ?? '1'), 1);

  const secretKey = resolveOmiseSecretKey(null);
  if (!secretKey) {
    return NextResponse.json(
      { error: 'OMISE_SECRET_KEY not set in .env.local', hint: 'Add OMISE_SECRET_KEY=skey_test_xxx' },
      { status: 500 },
    );
  }

  if (!isTestKey(secretKey)) {
    return NextResponse.json(
      { error: 'Only test keys allowed on this endpoint', key_prefix: secretKey.slice(0, 12) + '...' },
      { status: 403 },
    );
  }

  let charge;
  try {
    charge = await createPromptPayCharge({
      secretKey,
      amountTHB,
      description: 'Test QR — dev only',
      metadata: { source: 'test-qr-endpoint', env: process.env.NODE_ENV ?? 'unknown' },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Omise API call failed', key_prefix: secretKey.slice(0, 12) + '...' },
      { status: 502 },
    );
  }

  const omiseImageUrl = charge.source?.scannable_code?.image?.download_uri ?? null;
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000').replace(/\/+$/, '');

  return NextResponse.json({
    ok: true,
    charge_id: charge.id,
    status: charge.status,
    amount_thb: amountTHB,
    expires_at: charge.expires_at,
    is_test: true,
    // URL ที่ LINE ใช้ (proxy) — ใช้ booking_id จริงในโปรดักชัน
    qr_proxy_url: `${appUrl}/api/payments/qr-image?booking_id=TEST_ONLY`,
    // URL ตรงจาก Omise — ต้องใช้ auth header ถึงจะ download ได้
    omise_download_uri: omiseImageUrl,
    // เปิด URL นี้ใน browser เพื่อดู QR image (ใช้ curl หรือ Insomnia + Basic Auth: secretKey:)
    curl_command: omiseImageUrl
      ? `curl -u "${secretKey}:" "${omiseImageUrl}" --output qr_test.png`
      : null,
    // เปิดใน browser โดยใช้ data URI (ดึงผ่าน server แล้ว embed)
    view_url: `${appUrl}/api/payments/test-qr/view?charge_id=${charge.id}`,
  });
}
