/**
 * Browser-only canvas helpers for the rich menu builder and icon studio.
 * Nothing here may be imported from a server route.
 */

/** LINE rejects rich menu images above 1 MB. */
export const RICH_MENU_IMAGE_MAX_BYTES = 1_048_576;

/** Load an SVG (or any) `src` into an `HTMLImageElement` for `drawImage`. */
export function loadSvgImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('load svg failed'));
    img.src = src;
  });
}

/** Read the page's real font stack (Kanit via next/font) for canvas text. */
export function resolveFontStack(): string {
  if (typeof window === 'undefined') return 'sans-serif';
  const family = window.getComputedStyle(document.body).fontFamily;
  return family || 'sans-serif';
}

/**
 * Make sure the weights the renderer uses are actually loaded. `fonts.ready`
 * alone resolves even when a weight was never requested, and canvas
 * `fillText` does not trigger a load, so the first draw could fall back.
 */
export async function ensureFontsLoaded(fontStack: string): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return;
  const weights = [400, 500, 600, 700];
  await Promise.all(weights.map((w) => document.fonts.load(`${w} 40px ${fontStack}`).catch(() => [])));
  await document.fonts.ready;
}

/** Promise wrapper around `canvas.toBlob`. */
export function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

export type EncodedImage = { blob: Blob; mime: 'image/png' | 'image/jpeg'; attempts: number };

/**
 * Encode the canvas as PNG; if that exceeds `cap`, fall back to JPEG at
 * decreasing quality. Throws when nothing fits.
 */
export async function canvasToBlobUnderCap(canvas: HTMLCanvasElement, cap = RICH_MENU_IMAGE_MAX_BYTES): Promise<EncodedImage> {
  let attempts = 1;
  const png = await canvasToBlob(canvas, 'image/png');
  if (png && png.size <= cap) return { blob: png, mime: 'image/png', attempts };
  for (const quality of [0.92, 0.85, 0.78, 0.7]) {
    attempts += 1;
    // eslint-disable-next-line no-await-in-loop
    const jpeg = await canvasToBlob(canvas, 'image/jpeg', quality);
    if (jpeg && jpeg.size <= cap) return { blob: jpeg, mime: 'image/jpeg', attempts };
  }
  throw new Error('ไม่สามารถบีบอัดภาพให้ต่ำกว่า 1 MB ได้ — ลองใช้สไตล์ Clean');
}

/** Trigger a browser download of a blob. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/** Download a canvas as PNG. */
export async function downloadCanvas(canvas: HTMLCanvasElement, filename: string): Promise<void> {
  const blob = await canvasToBlob(canvas, 'image/png');
  if (blob) downloadBlob(blob, filename);
}
