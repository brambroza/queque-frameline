/**
 * Draws the customer rich menu image in the browser (canvas) so publishing
 * needs no image library on the server. Layout and labels come from
 * `RICH_MENU_TILES`; the portal font (Kanit) is used for the Thai text.
 * Browser-only: never import from a server route.
 */
import { RICH_MENU_SIZE, RICH_MENU_TILES, tileBounds, type RichMenuTile } from '@/lib/line/rich-menu';

/** The page's real font stack (Kanit via next/font) for canvas text. */
export function resolveFontStack(): string {
  if (typeof window === 'undefined') return 'sans-serif';
  return window.getComputedStyle(document.body).fontFamily || 'sans-serif';
}

/** Canvas `fillText` does not trigger a font load, so request the weights first. */
export async function ensureFontsLoaded(fontStack: string): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return;
  await Promise.all([400, 600, 700].map((w) => document.fonts.load(`${w} 40px ${fontStack}`).catch(() => [])));
  await document.fonts.ready;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Simple white glyphs; `s` is the icon box size, drawn centred at (cx, cy). */
function drawIcon(ctx: CanvasRenderingContext2D, icon: RichMenuTile['icon'], accent: string, cx: number, cy: number, s: number) {
  ctx.save();
  ctx.translate(cx - s / 2, cy - s / 2);
  ctx.fillStyle = '#FFFFFF';
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (icon === 'queue') {
    // Three list bars + a check badge.
    const barH = s * 0.13;
    [0.12, 0.42, 0.72].forEach((t, i) => { roundRect(ctx, s * 0.05, s * t, s * (i === 2 ? 0.55 : 0.9), barH, barH / 2); ctx.fill(); });
    ctx.beginPath(); ctx.arc(s * 0.78, s * 0.78, s * 0.2, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = accent;
    ctx.lineWidth = s * 0.06;
    ctx.beginPath(); ctx.moveTo(s * 0.68, s * 0.79); ctx.lineTo(s * 0.76, s * 0.87); ctx.lineTo(s * 0.9, s * 0.7); ctx.stroke();
  } else if (icon === 'doc') {
    // Page with a folded corner and text lines.
    const fold = s * 0.22;
    ctx.beginPath();
    ctx.moveTo(s * 0.15, 0); ctx.lineTo(s * 0.85 - fold, 0); ctx.lineTo(s * 0.85, fold); ctx.lineTo(s * 0.85, s); ctx.lineTo(s * 0.15, s); ctx.closePath();
    ctx.fill();
    ctx.fillStyle = accent;
    ctx.beginPath(); ctx.moveTo(s * 0.85 - fold, 0); ctx.lineTo(s * 0.85 - fold, fold); ctx.lineTo(s * 0.85, fold); ctx.closePath(); ctx.fill();
    [0.42, 0.58, 0.74].forEach((t, i) => { roundRect(ctx, s * 0.28, s * t, s * (i === 2 ? 0.28 : 0.44), s * 0.07, s * 0.035); ctx.fill(); });
    ctx.fillStyle = '#FFFFFF';
  } else {
    // Handset: a bent tube with two ear pieces.
    ctx.lineWidth = s * 0.16;
    ctx.beginPath();
    ctx.moveTo(s * 0.22, s * 0.16);
    ctx.quadraticCurveTo(s * 0.18, s * 0.6, s * 0.5, s * 0.82);
    ctx.quadraticCurveTo(s * 0.7, s * 0.9, s * 0.86, s * 0.78);
    ctx.stroke();
    roundRect(ctx, s * 0.08, s * 0.04, s * 0.26, s * 0.24, s * 0.08); ctx.fill();
    ctx.save(); ctx.translate(s * 0.82, s * 0.8); ctx.rotate(-Math.PI / 4); roundRect(ctx, -s * 0.13, -s * 0.12, s * 0.26, s * 0.24, s * 0.08); ctx.fill(); ctx.restore();
  }
  ctx.restore();
}

/**
 * Paint the full-size menu onto `canvas` (resized to 2500×843).
 * @param fontStack CSS font-family list; call `ensureFontsLoaded` first.
 */
export function drawRichMenu(canvas: HTMLCanvasElement, fontStack: string): void {
  canvas.width = RICH_MENU_SIZE.width;
  canvas.height = RICH_MENU_SIZE.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas 2d unavailable');
  const bounds = tileBounds();
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  RICH_MENU_TILES.forEach((tile, i) => {
    const b = bounds[i];
    ctx.fillStyle = tile.color;
    ctx.fillRect(b.x, b.y, b.width, b.height);
    // Soft inner panel gives the tile a pressed-button look.
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    roundRect(ctx, b.x + 36, b.y + 36, b.width - 72, b.height - 72, 48);
    ctx.fill();

    const cx = b.x + b.width / 2;
    // Icon badge.
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.beginPath(); ctx.arc(cx, b.y + 300, 150, 0, Math.PI * 2); ctx.fill();
    drawIcon(ctx, tile.icon, tile.color, cx, b.y + 300, 150);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `700 96px ${fontStack}`;
    ctx.fillText(tile.label, cx, b.y + 600);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = `400 44px ${fontStack}`;
    ctx.fillText(tile.sub, cx, b.y + 690);

    if (i > 0) { ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(b.x - 2, 0, 4, b.height); }
  });
}

/** Full-size PNG bytes of the menu, ready for the publish route. */
export async function renderRichMenuPng(): Promise<Blob> {
  const fontStack = resolveFontStack();
  await ensureFontsLoaded(fontStack);
  const canvas = document.createElement('canvas');
  drawRichMenu(canvas, fontStack);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('สร้างภาพเมนูไม่สำเร็จ');
  return blob;
}

/** Base64 (no data: prefix) of a blob. */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '');
    r.onerror = () => reject(new Error('อ่านภาพไม่สำเร็จ'));
    r.readAsDataURL(blob);
  });
}
