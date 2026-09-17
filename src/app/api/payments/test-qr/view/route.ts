import { resolveOmiseSecretKey } from '@/lib/payments/omise';

/**
 * DEV-ONLY — ดึง QR image จาก Omise แล้ว render เป็น HTML ใน browser
 * GET /api/payments/test-qr/view?charge_id=chrg_test_xxx
 */
export async function GET(req: Request) {
  if (process.env.NODE_ENV === 'production') {
    return new Response('Not available in production', { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const chargeId = searchParams.get('charge_id');
  if (!chargeId) {
    return new Response('Missing charge_id', { status: 400 });
  }

  const secretKey = resolveOmiseSecretKey(null);
  if (!secretKey) {
    return new Response('OMISE_SECRET_KEY not set', { status: 500 });
  }

  // Re-fetch the charge to get scannable_code image URL
  const authHeader = 'Basic ' + Buffer.from(`${secretKey}:`).toString('base64');
  const chargeRes = await fetch(`https://api.omise.co/charges/${chargeId}`, {
    headers: { Authorization: authHeader },
  });
  if (!chargeRes.ok) {
    return new Response(`Omise error: ${chargeRes.status}`, { status: 502 });
  }

  const charge = (await chargeRes.json()) as {
    id: string;
    amount: number;
    status: string;
    expires_at: string | null;
    source?: { scannable_code?: { image?: { download_uri: string } } };
  };

  const downloadUri = charge.source?.scannable_code?.image?.download_uri;
  if (!downloadUri) {
    return new Response('No QR image in charge response', { status: 404 });
  }

  // Fetch the actual QR image bytes from Omise
  const imgRes = await fetch(downloadUri, { headers: { Authorization: authHeader } });
  if (!imgRes.ok) {
    return new Response('Failed to fetch QR image from Omise', { status: 502 });
  }
  const imgBuffer = await imgRes.arrayBuffer();
  const base64 = Buffer.from(imgBuffer).toString('base64');
  const contentType = imgRes.headers.get('content-type') ?? 'image/png';
  const dataUri = `data:${contentType};base64,${base64}`;

  const amountTHB = (charge.amount / 100).toFixed(2);
  const expiresLabel = charge.expires_at
    ? new Date(charge.expires_at).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })
    : '-';

  const html = `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>QR Test — ${chargeId}</title>
  <style>
    body { font-family: sans-serif; background: #f5f5f5; display: flex; justify-content: center; padding: 2rem; }
    .card { background: white; border-radius: 1rem; padding: 2rem; max-width: 360px; width: 100%; text-align: center; box-shadow: 0 4px 16px rgba(0,0,0,.1); }
    h2 { color: #1a73e8; margin: 0 0 .5rem; }
    .badge { display: inline-block; background: #fff3e0; color: #e65100; border-radius: 4px; padding: 2px 8px; font-size: .75rem; font-weight: bold; margin-bottom: 1rem; }
    img { width: 220px; height: 220px; border: 2px solid #e0e0e0; border-radius: .5rem; }
    .amount { font-size: 2rem; font-weight: bold; color: #2e7d32; margin: 1rem 0 .25rem; }
    .label { color: #757575; font-size: .85rem; }
    .id { font-family: monospace; font-size: .75rem; color: #9e9e9e; margin-top: 1rem; word-break: break-all; }
    .status { margin-top: .5rem; font-size: .85rem; }
    .status.pending { color: #f57c00; }
  </style>
</head>
<body>
  <div class="card">
    <h2>PromptPay QR</h2>
    <div class="badge">TEST MODE</div>
    <br/>
    <img src="${dataUri}" alt="QR Code"/>
    <div class="amount">฿${amountTHB}</div>
    <div class="label">สแกนด้วยแอปธนาคาร</div>
    <div class="status pending">สถานะ: ${charge.status}</div>
    <div class="label" style="margin-top:.5rem">หมดอายุ: ${expiresLabel}</div>
    <div class="id">${chargeId}</div>
  </div>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
