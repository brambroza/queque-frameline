'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

/**
 * QR image for a URL. Plain `<img>` so it works in both the MUI portal and the
 * Tailwind public pages, and prints as-is on the DO.
 */
export function QrCode({ value, size = 180, alt = 'QR code' }: { value: string; size?: number; alt?: string }) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(value, { width: size * 2, margin: 1, errorCorrectionLevel: 'M' })
      .then((url) => { if (alive) setSrc(url); })
      .catch(() => { if (alive) setSrc(null); });
    return () => { alive = false; };
  }, [value, size]);

  if (!src) return <div style={{ width: size, height: size }} aria-hidden />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} width={size} height={size} alt={alt} style={{ display: 'block' }} />;
}
