/**
 * Browser-side screenshot helpers for the feedback button.
 * `captureScreenshot` renders the current DOM with `html-to-image` (loaded on
 * demand so it never lands in the portal bundle) and downsizes the result to
 * keep the upload small. The pure helpers are unit-tested.
 */
import { FEEDBACK_SCREENSHOT_MAX_BYTES } from '@/lib/feedback/constants';

/** Elements carrying this attribute (FAB, toasts, dialogs) are left out of the screenshot. */
export const FEEDBACK_IGNORE_ATTR = 'data-feedback-ignore';

/** Approximate byte size of the image encoded in a base64 data URL. */
export function estimateDataUrlBytes(dataUrl: string): number {
  const comma = dataUrl.indexOf(',');
  const b64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  const padding = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
  return Math.floor((b64.length * 3) / 4) - padding;
}

/** Target width/height that fits `maxWidth` while keeping the aspect ratio. */
export function fitWidth(width: number, height: number, maxWidth: number): { width: number; height: number } {
  if (width <= maxWidth || width <= 0) return { width: Math.max(1, Math.round(width)), height: Math.max(1, Math.round(height)) };
  const scale = maxWidth / width;
  return { width: maxWidth, height: Math.max(1, Math.round(height * scale)) };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image_decode_failed'));
    img.src = src;
  });
}

/**
 * Re-encode a data URL no wider than `maxWidth`. PNG (lossless, crisp UI text)
 * is preferred; when the PNG exceeds the size cap the image falls back to JPEG
 * with quality stepping down. Returns null when nothing fits.
 */
export async function downscaleDataUrl(dataUrl: string, maxWidth = 1600): Promise<string | null> {
  const img = await loadImage(dataUrl);
  const { width, height } = fitWidth(img.naturalWidth || img.width, img.naturalHeight || img.height, maxWidth);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);
  const png = canvas.toDataURL('image/png');
  if (estimateDataUrlBytes(png) <= FEEDBACK_SCREENSHOT_MAX_BYTES) return png;
  for (const quality of [0.8, 0.65, 0.5, 0.35]) {
    const out = canvas.toDataURL('image/jpeg', quality);
    if (estimateDataUrlBytes(out) <= FEEDBACK_SCREENSHOT_MAX_BYTES) return out;
  }
  return null;
}

/**
 * Capture the visible document as a PNG data URL (JPEG only when the PNG is
 * over the size cap), skipping elements marked with `data-feedback-ignore`.
 * Resolves to null when the browser cannot render the page (tainted canvas,
 * blocked fonts, unsupported API) so the caller can continue without an image.
 */
export async function captureScreenshot(): Promise<string | null> {
  try {
    const { toPng } = await import('html-to-image');
    const target = document.body;
    const raw = await toPng(target, {
      pixelRatio: 1,
      cacheBust: true,
      backgroundColor: '#ffffff',
      width: window.innerWidth,
      height: window.innerHeight,
      style: { transform: `translate(${-window.scrollX}px, ${-window.scrollY}px)`, transformOrigin: 'top left' },
      filter: (node: HTMLElement) => !(node instanceof Element && node.hasAttribute(FEEDBACK_IGNORE_ATTR)),
    });
    if (!raw) return null;
    return await downscaleDataUrl(raw);
  } catch {
    return null;
  }
}
