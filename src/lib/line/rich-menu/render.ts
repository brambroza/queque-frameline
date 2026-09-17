import { iconDataUrl } from './icons';
import { LAYOUTS } from './layouts';
import { shade, tint } from './colors';
import type { RichMenuConfig } from './schema';

/**
 * Minimal canvas surface the renderer needs. Satisfied by the browser's
 * `CanvasRenderingContext2D`; typed loosely so a Node canvas could be used.
 */
export type RenderContext = CanvasRenderingContext2D;

export type RenderOptions = {
  /** 1 = full 2500-wide export; ~0.14 for a phone preview. */
  scale: number;
  /** CSS font-family stack, Kanit first. */
  fontStack: string;
  /** Load an image from a `data:` SVG URL (browser: `Image`, server: resvg). */
  loadImage: (src: string) => Promise<CanvasImageSource>;
  /** Shop name printed under the hero label. */
  shopName?: string;
};

const INK = '#10201a';
const INK_SOFT = '#4b5f56';

function roundedRect(ctx: RenderContext, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Colors derived from style + primary. */
export function resolveStyleColors(style: RichMenuConfig['style'], primary: string) {
  if (style === 'bold') {
    return { ground: primary, glyph: '#ffffff', knockout: primary, label: '#ffffff', subtitle: 'rgba(255,255,255,.78)', accent: 'rgba(255,255,255,.9)', divider: 'rgba(255,255,255,.28)' };
  }
  if (style === 'card') {
    return { ground: tint(primary, 0.9), glyph: primary, knockout: '#ffffff', label: INK, subtitle: INK_SOFT, accent: primary, divider: null };
  }
  return { ground: '#ffffff', glyph: primary, knockout: tint(primary, 0.88), label: INK, subtitle: INK_SOFT, accent: primary, divider: '#dfe6e2' };
}

/**
 * Draw the whole rich menu. Always lays out in 2500-space and applies
 * `scale` through the transform, so preview and export share one code path.
 * The caller sizes the canvas to `layout.width * scale` × `layout.height * scale`.
 */
export async function renderRichMenu(ctx: RenderContext, config: RichMenuConfig, options: RenderOptions): Promise<void> {
  const layout = LAYOUTS[config.layout];
  const primary = config.palette.primary;
  const colors = resolveStyleColors(config.style, primary);
  const font = options.fontStack;
  const subtitle = (options.shopName ?? config.heroSubtitle ?? '').trim();

  ctx.save();
  ctx.setTransform(options.scale, 0, 0, options.scale, 0, 0);
  ctx.clearRect(0, 0, layout.width, layout.height);
  ctx.fillStyle = colors.ground;
  ctx.fillRect(0, 0, layout.width, layout.height);

  for (let i = 0; i < layout.cells.length; i += 1) {
    const cell = layout.cells[i];
    const button = config.buttons[i];
    if (!button) continue;
    const { x, y, width: w, height: h } = cell;
    const cx = x + w / 2;
    const cy = y + h / 2;

    if (config.style === 'card') {
      const pad = 54;
      ctx.save();
      ctx.shadowColor = 'rgba(16,32,26,.10)';
      ctx.shadowBlur = 40;
      ctx.shadowOffsetY = 14;
      ctx.fillStyle = '#ffffff';
      roundedRect(ctx, x + pad, y + pad, w - pad * 2, h - pad * 2, 64);
      ctx.fill();
      ctx.restore();
    }
    if (config.style === 'bold' && cell.hero) {
      const gradient = ctx.createLinearGradient(0, y, 0, y + h);
      gradient.addColorStop(0, tint(primary, 0.12));
      gradient.addColorStop(1, shade(primary, 0.14));
      ctx.fillStyle = gradient;
      ctx.fillRect(x, y, w, h);
    }

    const glyphSize = cell.hero ? h * 0.44 : Math.min(w, h) * 0.4;
    let gx = cx - glyphSize / 2;
    let gy = cy - glyphSize * 0.72;
    if (cell.hero) {
      gx = x + w * 0.3 - glyphSize / 2;
      gy = cy - glyphSize / 2;
    }
    if (config.style === 'clean') {
      ctx.fillStyle = tint(primary, 0.9);
      ctx.beginPath();
      ctx.arc(gx + glyphSize / 2, gy + glyphSize / 2, glyphSize * 0.72, 0, Math.PI * 2);
      ctx.fill();
    }
    // eslint-disable-next-line no-await-in-loop
    const img = await options.loadImage(iconDataUrl(button.iconKey, colors.glyph, colors.knockout, Math.round(glyphSize)));
    ctx.drawImage(img, gx, gy, glyphSize, glyphSize);

    ctx.fillStyle = colors.label;
    ctx.textBaseline = 'middle';
    if (cell.hero) {
      ctx.textAlign = 'left';
      const tx = x + w * 0.3 + glyphSize / 2 + 70;
      const maxW = w * 0.5;
      ctx.font = `700 ${h * 0.19}px ${font}`;
      ctx.fillText(button.label, tx, cy - h * 0.08, maxW);
      if (subtitle) {
        ctx.fillStyle = colors.subtitle;
        ctx.font = `400 ${h * 0.09}px ${font}`;
        ctx.fillText(subtitle, tx, cy + h * 0.11, maxW);
      }
      ctx.fillStyle = colors.accent;
      ctx.font = `500 ${h * 0.075}px ${font}`;
      ctx.fillText('แตะเพื่อจอง  ›', tx, cy + h * 0.24, maxW);
    } else {
      ctx.textAlign = 'center';
      const fontSize = Math.min(w, h) * (button.label.length > 10 ? 0.1 : 0.12);
      ctx.font = `600 ${fontSize}px ${font}`;
      ctx.fillText(button.label, cx, cy + glyphSize * 0.62, w * 0.84);
    }
  }

  if (colors.divider) {
    ctx.strokeStyle = colors.divider;
    ctx.lineWidth = 4;
    const drawn = new Set<string>();
    for (const cell of layout.cells) {
      if (cell.x > 0) {
        const key = `v${cell.x}:${cell.y}`;
        if (!drawn.has(key)) {
          drawn.add(key);
          ctx.beginPath();
          ctx.moveTo(cell.x, cell.y);
          ctx.lineTo(cell.x, cell.y + cell.height);
          ctx.stroke();
        }
      }
      if (cell.y > 0) {
        ctx.beginPath();
        ctx.moveTo(cell.x, cell.y);
        ctx.lineTo(cell.x + cell.width, cell.y);
        ctx.stroke();
      }
    }
  }
  ctx.restore();
}
