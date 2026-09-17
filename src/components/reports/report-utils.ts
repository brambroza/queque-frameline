import { longThaiDate, shortThaiDate, weekdayName, weekdayOfISO, type Translate } from '@/components/dashboard/dashboard-utils';
import type { ReportPreset } from '@/lib/reports/range-presets';

/**
 * Human label for the resolved report range, e.g. "พรุ่งนี้ · อาทิตย์ 13 ก.ย. 2569"
 * or "7 ก.ย. – 13 ก.ย. 2569". Weekday names come from the dashboard namespace.
 */
export function reportRangeLabel(t: Translate, preset: ReportPreset, from: string, to: string): string {
  if (from === to) {
    const day = `${weekdayName(t, weekdayOfISO(from))} ${longThaiDate(from)}`;
    if (preset === 'today') return `${t('preset_today', 'วันนี้')} · ${day}`;
    if (preset === 'tomorrow') return `${t('preset_tomorrow', 'พรุ่งนี้')} · ${day}`;
    return day;
  }
  return `${shortThaiDate(from)} – ${longThaiDate(to)}`;
}

/** File-name-safe stem for exports, e.g. `report-2026-09-12` or `report-2026-09-01_2026-09-30`. */
export function reportFileStem(from: string, to: string): string {
  return from === to ? `report-${from}` : `report-${from}_${to}`;
}

/** Bangkok-formatted timestamp for the "generated at" footer. */
export function formatGeneratedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
