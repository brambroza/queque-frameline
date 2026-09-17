import type { ReportData } from '@/types/reports';

/** Translate function shape (namespace `reports`). */
export type Translate = (key: string, fallback?: string) => string;

/** Formatters the summary needs but must not hard-code (locale lives in the UI layer). */
export type SummaryFormat = {
  /** ISO date → human label, e.g. "อาทิตย์ 13 ก.ย. 2569". */
  date: (iso: string) => string;
  /** Hour of day → "09:00–10:00". */
  hourRange: (hour: number) => string;
  /** Status key → label. */
  status: (status: string) => string;
};

/**
 * Replace `{{name}}` placeholders in a translated template.
 */
function fmt(template: string, params: Record<string, string | number>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => String(params[key] ?? ''));
}

function pctOf(num: number, den: number): number {
  return den > 0 ? Math.round((num / den) * 100) : 0;
}

/** "▲ 12%" / "▼ 5%" / "เท่าเดิม" versus a previous value. */
function deltaText(t: Translate, cur: number, prev: number): string {
  if (prev === 0 && cur === 0) return t('delta_flat', 'เท่าเดิม');
  if (prev === 0) return t('delta_new', 'เพิ่มขึ้นจาก 0');
  const p = Math.round(((cur - prev) / prev) * 100);
  if (p === 0) return t('delta_flat', 'เท่าเดิม');
  return fmt(p > 0 ? t('delta_up', 'เพิ่มขึ้น {{pct}}%') : t('delta_down', 'ลดลง {{pct}}%'), { pct: Math.abs(p) });
}

/**
 * Executive-summary sentences for the report, derived from the numbers so the
 * document reads as prose rather than a wall of tiles. Order:
 * volume → outcome → peak → top service → top staff → customers → comparison.
 *
 * Upcoming ranges (start after today) describe the booked queue instead of
 * outcomes, since nothing has completed yet.
 */
export function buildReportSummary(data: ReportData, t: Translate, f: SummaryFormat): string[] {
  const { kpi, range } = data;
  const out: string[] = [];
  const upcoming = range.from > range.today;
  const singleDay = range.from === range.to;

  if (kpi.total === 0) {
    out.push(t('sum_empty', 'ไม่มีคิวในช่วงที่เลือก'));
    return out;
  }

  // ── Volume / outcome ──
  if (upcoming) {
    const pending = data.by_status.filter((s) => s.status === 'pending' || s.status === 'pending_approval').reduce((a, s) => a + s.count, 0);
    out.push(fmt(t('sum_upcoming', 'มีคิวจองล่วงหน้าทั้งหมด {{total}} คิว ยังใช้งาน {{booked}} คิว รอยืนยัน {{pending}} คิว ยกเลิกแล้ว {{cancelled}} คิว'), { total: kpi.total, booked: kpi.booked, pending, cancelled: kpi.cancelled }));
  } else {
    out.push(
      fmt(t('sum_volume', 'มีคิวทั้งหมด {{total}} คิว เสร็จสิ้น {{completed}} คิว ({{completedPct}}%) ยกเลิก {{cancelled}} คิว และไม่มาตามนัด {{noShow}} คิว รวมอัตรายกเลิก+ไม่มา {{cancelRate}}%'), {
        total: kpi.total,
        completed: kpi.completed,
        completedPct: pctOf(kpi.completed, kpi.total),
        cancelled: kpi.cancelled,
        noShow: kpi.no_show,
        cancelRate: kpi.cancel_rate,
      }),
    );
    if (!singleDay) {
      const avg = Math.round((kpi.total / Math.max(1, range.days)) * 10) / 10;
      out.push(fmt(t('sum_average', 'เฉลี่ย {{avg}} คิวต่อวัน ตลอด {{days}} วัน'), { avg, days: range.days }));
    }
  }

  // ── Peak ──
  if (singleDay) {
    const peak = data.by_hour.reduce<{ hour: number; count: number } | null>((m, h) => (h.count > (m?.count ?? 0) ? h : m), null);
    if (peak) out.push(fmt(t('sum_peak_hour', 'ช่วงเวลาที่หนาแน่นที่สุดคือ {{hour}} ({{count}} คิว)'), { hour: f.hourRange(peak.hour), count: peak.count }));
  } else {
    const peak = data.by_day.reduce<ReportData['by_day'][number] | null>((m, d) => (d.count > (m?.count ?? 0) ? d : m), null);
    const quiet = data.by_day.filter((d) => d.count > 0).reduce<ReportData['by_day'][number] | null>((m, d) => (m === null || d.count < m.count ? d : m), null);
    if (peak) out.push(fmt(t('sum_peak_day', 'วันที่มีคิวมากที่สุดคือ{{day}} ({{count}} คิว)'), { day: f.date(peak.date), count: peak.count }));
    if (quiet && peak && quiet.date !== peak.date) out.push(fmt(t('sum_quiet_day', 'วันที่มีคิวน้อยที่สุดคือ{{day}} ({{count}} คิว)'), { day: f.date(quiet.date), count: quiet.count }));
  }

  // ── Top service / staff ──
  const topService = data.popular_services[0];
  if (topService) out.push(fmt(t('sum_top_service', 'บริการที่ถูกจองมากที่สุดคือ "{{name}}" {{count}} คิว ({{pct}}% ของทั้งหมด)'), { name: topService.name, count: topService.count, pct: topService.pct }));
  const topStaff = data.by_staff.find((s) => s.name !== 'ไม่ระบุ') ?? null;
  if (topStaff && data.by_staff.length > 1) out.push(fmt(t('sum_top_staff', 'ผู้ให้บริการที่รับคิวมากที่สุดคือ {{name}} {{count}} คิว'), { name: topStaff.name, count: topStaff.count }));
  if (data.by_branch.length > 1 && data.by_branch[0]) out.push(fmt(t('sum_top_branch', 'สาขาที่มีคิวมากที่สุดคือ {{name}} {{count}} คิว ({{pct}}%)'), { name: data.by_branch[0].name, count: data.by_branch[0].count, pct: data.by_branch[0].pct }));

  // ── Customers ──
  const customers = kpi.customers_new + kpi.customers_returning;
  if (customers > 0) {
    out.push(fmt(t('sum_customers', 'ลูกค้าที่ใช้บริการ {{customers}} ราย เป็นลูกค้าใหม่ {{newCount}} ราย และลูกค้าเดิมที่กลับมาซ้ำ {{returning}} ราย ({{pct}}%)'), { customers, newCount: kpi.customers_new, returning: kpi.customers_returning, pct: pctOf(kpi.customers_returning, customers) }));
  }

  // ── Comparison with the previous period ──
  if (data.prev) {
    const prevRate = pctOf(data.prev.cancelled + data.prev.no_show, data.prev.total);
    out.push(
      fmt(t('sum_compare', 'เทียบกับช่วงก่อนหน้า ({{from}} – {{to}}) จำนวนคิว{{delta}} (จาก {{prevTotal}} เป็น {{total}} คิว) และอัตรายกเลิก+ไม่มา{{rateDelta}}'), {
        from: f.date(data.prev.from),
        to: f.date(data.prev.to),
        delta: deltaText(t, kpi.total, data.prev.total),
        prevTotal: data.prev.total,
        total: kpi.total,
        rateDelta: kpi.cancel_rate === prevRate ? t('delta_flat', 'เท่าเดิม') : fmt(kpi.cancel_rate > prevRate ? t('delta_rate_up', 'สูงขึ้น {{pts}} จุด') : t('delta_rate_down', 'ลดลง {{pts}} จุด'), { pts: Math.abs(kpi.cancel_rate - prevRate) }),
      }),
    );
  }

  // ── Watch-outs ──
  if (!upcoming && kpi.total >= 10 && kpi.cancel_rate >= 15) {
    out.push(fmt(t('sum_warn_cancel', 'อัตรายกเลิก+ไม่มา {{rate}}% สูงกว่าเกณฑ์ 15% ควรพิจารณาเปิดมัดจำล่วงหน้าหรือส่ง LINE เตือนก่อนถึงคิว'), { rate: kpi.cancel_rate }));
  }

  return out;
}
