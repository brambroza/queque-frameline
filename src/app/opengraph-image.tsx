import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = 'image/png';

/**
 * Kanit for the social card. Satori ships a Latin-only fallback, so without
 * these files the Thai headline renders as empty boxes on LINE/Facebook/X.
 * The TTFs live in public/fonts (SIL OFL, licence file alongside them).
 */
async function loadKanit(): Promise<Array<{ name: string; data: ArrayBuffer; weight: 400 | 700; style: 'normal' }>> {
  const dir = path.join(process.cwd(), 'public', 'fonts');
  const [regular, bold] = await Promise.all([
    readFile(path.join(dir, 'Kanit-Regular.ttf')),
    readFile(path.join(dir, 'Kanit-Bold.ttf')),
  ]);
  const toArrayBuffer = (buf: Buffer): ArrayBuffer =>
    buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
  return [
    { name: 'Kanit', data: toArrayBuffer(regular), weight: 400, style: 'normal' },
    { name: 'Kanit', data: toArrayBuffer(bold), weight: 700, style: 'normal' },
  ];
}

/**
 * Hostname printed in the card footer — the same origin `metadataBase` in the
 * root layout resolves to, so the card never advertises a stale deploy URL.
 */
function siteHost(): string {
  const fallback = 'queuebooking.com';
  try {
    return new URL(process.env.NEXT_PUBLIC_APP_URL || `https://${fallback}`).host || fallback;
  } catch {
    return fallback;
  }
}

export default async function OgImage() {
  const fonts = await loadKanit();
  const host = siteHost();
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: 'linear-gradient(135deg, #eaf6ee 0%, #ffffff 55%, #f6f7f9 100%)',
          padding: '56px',
          fontFamily: 'Kanit',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              background: '#12a862',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 28,
              fontWeight: 700,
            }}
          >
            Q
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 36, color: '#0f172a', fontWeight: 700 }}>QueueBooking LINE</div>
            <div style={{ fontSize: 20, color: '#475569' }}>| ระบบจองคิวผ่าน LINE OA | QueueBooking LINE</div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 56, color: '#111827', fontWeight: 700, lineHeight: 1.2 }}>
            ระบบจองคิวผ่าน LINE OA
          </div>
          <div style={{ fontSize: 28, color: '#334155' }}>
            Manage branches, services, bookings, and reports in one dashboard
          </div>
        </div>

        <div style={{ fontSize: 20, color: '#64748b' }}>{host}</div>
      </div>
    ),
    {
      ...size,
      fonts,
    },
  );
}
