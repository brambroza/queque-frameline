import type { CSSProperties } from 'react';
import type { SignageTheme } from '@/lib/signage/types';

/** One colour set for the signage. Exposed to templates as `--sg-*` CSS variables. */
export type SignagePalette = {
  id: SignageTheme;
  label_th: string;
  label_en: string;
  bg: string;
  bg2: string;
  surface: string;
  surface2: string;
  line: string;
  text: string;
  muted: string;
  accent: string;
  accentContrast: string;
  isLight: boolean;
};

export const SIGNAGE_PALETTES: Record<SignageTheme, SignagePalette> = {
  emerald: {
    id: 'emerald', label_th: 'เขียวมรกต', label_en: 'Emerald',
    bg: '#070d07', bg2: '#0c1a10', surface: 'rgba(255,255,255,0.05)', surface2: 'rgba(255,255,255,0.09)',
    line: 'rgba(255,255,255,0.10)', text: '#eef8ee', muted: '#8ca98c', accent: '#4ade80', accentContrast: '#052e16', isLight: false,
  },
  midnight: {
    id: 'midnight', label_th: 'มิดไนท์', label_en: 'Midnight',
    bg: '#0b0f16', bg2: '#101a2b', surface: 'rgba(255,255,255,0.05)', surface2: 'rgba(255,255,255,0.09)',
    line: 'rgba(255,255,255,0.10)', text: '#e6edf5', muted: '#94a1b2', accent: '#60a5fa', accentContrast: '#0b1a33', isLight: false,
  },
  restaurant: {
    id: 'restaurant', label_th: 'ส้มอุ่น', label_en: 'Warm Orange',
    bg: '#1a0f08', bg2: '#0d0a08', surface: 'rgba(255,255,255,0.05)', surface2: 'rgba(255,255,255,0.09)',
    line: 'rgba(255,255,255,0.10)', text: '#fff4ea', muted: '#c9a58a', accent: '#fb923c', accentContrast: '#2a1204', isLight: false,
  },
  clinic: {
    id: 'clinic', label_th: 'ฟ้าคลินิก', label_en: 'Clinic Blue',
    bg: '#081420', bg2: '#0a1018', surface: 'rgba(255,255,255,0.05)', surface2: 'rgba(255,255,255,0.09)',
    line: 'rgba(255,255,255,0.10)', text: '#eaf6ff', muted: '#8fb3cc', accent: '#38bdf8', accentContrast: '#05202e', isLight: false,
  },
  meeting: {
    id: 'meeting', label_th: 'ม่วงประชุม', label_en: 'Meeting Violet',
    bg: '#120c22', bg2: '#0c0a14', surface: 'rgba(255,255,255,0.05)', surface2: 'rgba(255,255,255,0.09)',
    line: 'rgba(255,255,255,0.10)', text: '#f1ecff', muted: '#a99bc9', accent: '#a78bfa', accentContrast: '#1e1038', isLight: false,
  },
  nail: {
    id: 'nail', label_th: 'ชมพูบิวตี้', label_en: 'Beauty Pink',
    bg: '#1f0a14', bg2: '#0f0a0f', surface: 'rgba(255,255,255,0.05)', surface2: 'rgba(255,255,255,0.09)',
    line: 'rgba(255,255,255,0.10)', text: '#fff0f6', muted: '#d1a3b8', accent: '#f9a8d4', accentContrast: '#3a0f24', isLight: false,
  },
  light: {
    id: 'light', label_th: 'สว่าง', label_en: 'Light',
    bg: '#f7f8fa', bg2: '#ffffff', surface: '#ffffff', surface2: '#f1f4f2',
    line: '#e3e8ef', text: '#121926', muted: '#697586', accent: '#12a862', accentContrast: '#ffffff', isLight: true,
  },
};

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const n = Number.parseInt(full, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Build the inline style that exposes a palette as `--sg-*` variables. */
export function paletteToStyle(palette: SignagePalette): CSSProperties {
  return {
    '--sg-bg': palette.bg,
    '--sg-bg-2': palette.bg2,
    '--sg-surface': palette.surface,
    '--sg-surface-2': palette.surface2,
    '--sg-line': palette.line,
    '--sg-text': palette.text,
    '--sg-muted': palette.muted,
    '--sg-accent': palette.accent,
    '--sg-accent-contrast': palette.accentContrast,
    '--sg-accent-soft': hexToRgba(palette.accent, palette.isLight ? 0.12 : 0.16),
    '--sg-glow': hexToRgba(palette.accent, palette.isLight ? 0.25 : 0.45),
  } as CSSProperties;
}

/** Look up a palette, defaulting to emerald for unknown ids. */
export function getPalette(theme: SignageTheme | string | null | undefined): SignagePalette {
  return SIGNAGE_PALETTES[(theme ?? 'emerald') as SignageTheme] ?? SIGNAGE_PALETTES.emerald;
}
