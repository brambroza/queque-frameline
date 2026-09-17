import { brand, lineGreen, neutral } from '@/theme/tokens';

/** Recommended primary colors for a rich menu. */
export const COLOR_PRESETS: ReadonlyArray<{ label: string; value: string }> = [
  { label: 'LINE Green', value: lineGreen },
  { label: 'Brand Green', value: brand[500] },
  { label: 'Deep Green', value: brand[700] },
  { label: 'Ocean', value: '#2e8ad8' },
  { label: 'Navy', value: '#1f3a8a' },
  { label: 'Slate Navy', value: '#3b4f7a' },
  { label: 'Sunset', value: '#f07d29' },
  { label: 'Red', value: '#e14b4a' },
  { label: 'Rose', value: '#e0508a' },
  { label: 'Purple', value: '#7b52d3' },
  { label: 'Charcoal', value: neutral[800] },
];

/** Parse `#rgb` / `#rrggbb` into channel values. */
export function hexToRgb(hex: string): [number, number, number] {
  const normalized = hex.replace('#', '');
  const full = normalized.length === 3 ? normalized.split('').map((ch) => ch + ch).join('') : normalized;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as [number, number, number];
}

/** Convert a hex color to an rgba() string with the given alpha. */
export function withAlpha(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Linear mix of two hex colors; `ratio` 0 = `from`, 1 = `to`. */
export function mixHex(from: string, to: string, ratio: number): string {
  const a = hexToRgb(from);
  const b = hexToRgb(to);
  return `#${a.map((v, i) => Math.round(v + (b[i] - v) * ratio).toString(16).padStart(2, '0')).join('')}`;
}

/** Lighten toward white; `ratio` 0.9 = 90% white. */
export function tint(hex: string, ratio: number): string {
  return mixHex(hex, '#ffffff', ratio);
}

/** Darken toward black. */
export function shade(hex: string, ratio: number): string {
  return mixHex(hex, '#000000', ratio);
}

/**
 * Mix a color with white keeping the given `ratio` of the original.
 * Kept for the icon studio's `tint` variant (ratio 0.12 = very light).
 */
export function mixWithWhite(hex: string, ratio: number): string {
  return tint(hex, 1 - ratio);
}
