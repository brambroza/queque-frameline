import type { RangeKind } from '@/types/dashboard';

/** Translate function shape returned by `useTranslation(namespace)`. */
export type Translate = (key: string, fallback?: string) => string;

/**
 * Replace `{{name}}` placeholders in a translated template.
 */
export function fmt(template: string, params: Record<string, string | number>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => String(params[key] ?? ''));
}

/** `HH:00` label for an hour of day. */
export function hourLabel(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`;
}

/** Short Thai date without year, e.g. "12 ก.ย.". */
export function shortThaiDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

/** Thai date with Buddhist year, e.g. "12 ก.ย. 2569". */
export function longThaiDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

/** Weekday (0 = Sunday) of an ISO date. */
export function weekdayOfISO(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Localized weekday name via the dashboard namespace (`wd_0` … `wd_6`). */
export function weekdayName(t: Translate, weekday: number): string {
  const fallback = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
  return t(`wd_${weekday}`, fallback[weekday] ?? '');
}

/** Human label for the selected range, e.g. "วันนี้ · เสาร์ 12 ก.ย. 2569" or "7 ก.ย. – 13 ก.ย. 2569". */
export function rangeLabel(t: Translate, kind: RangeKind, from: string, to: string): string {
  if (kind === 'today') return `${t('range_today', 'วันนี้')} · ${weekdayName(t, weekdayOfISO(from))} ${longThaiDate(from)}`;
  if (from === to) return longThaiDate(from);
  return `${shortThaiDate(from)} – ${longThaiDate(to)}`;
}

/** Utilization tone thresholds shared by tiles, bars and heatmap. */
export function utilizationTone(pctValue: number): 'warning' | 'success' | 'error' {
  if (pctValue < 40) return 'warning';
  if (pctValue > 85) return 'error';
  return 'success';
}
