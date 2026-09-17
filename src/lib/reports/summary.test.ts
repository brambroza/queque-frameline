import { describe, expect, it } from 'vitest';
import { buildReportSummary, type SummaryFormat } from './summary';
import type { ReportData } from '@/types/reports';

const t = (_key: string, fallback?: string) => fallback ?? _key;
const f: SummaryFormat = { date: (iso) => iso, hourRange: (h) => `${h}:00`, status: (s) => s };

function base(over: Partial<ReportData> = {}): ReportData {
  return {
    range: { preset: 'last7', from: '2026-09-06', to: '2026-09-12', days: 7, today: '2026-09-12' },
    shop: { name: 'Shop', logo_url: null },
    branch: { name: null },
    kpi: { total: 20, booked: 15, completed: 12, cancelled: 3, no_show: 2, cancel_rate: 25, customers_new: 6, customers_returning: 4 },
    prev: { from: '2026-08-30', to: '2026-09-05', total: 10, completed: 8, cancelled: 1, no_show: 0 },
    by_day: [
      { date: '2026-09-06', count: 2, completed: 2, cancelled: 0, no_show: 0 },
      { date: '2026-09-07', count: 9, completed: 5, cancelled: 2, no_show: 2 },
      { date: '2026-09-08', count: 0, completed: 0, cancelled: 0, no_show: 0 },
    ],
    by_hour: [{ hour: 9, count: 3 }, { hour: 14, count: 7 }],
    by_status: [{ status: 'completed', count: 12 }, { status: 'pending', count: 3 }],
    popular_services: [{ name: 'ตัดผม', count: 11, pct: 55 }],
    by_branch: [{ name: 'A', count: 20, pct: 100 }],
    by_staff: [{ name: 'ไม่ระบุ', count: 12, completed: 8, cancelled: 2, no_show: 2 }, { name: 'พี่บอย', count: 8, completed: 4, cancelled: 1, no_show: 0 }],
    bookings: { rows: [], total: 20, truncated: false },
    generated_at: '2026-09-12T10:00:00Z',
    ...over,
  };
}

describe('buildReportSummary', () => {
  it('returns a single empty line when there are no bookings', () => {
    const lines = buildReportSummary(base({ kpi: { total: 0, booked: 0, completed: 0, cancelled: 0, no_show: 0, cancel_rate: 0, customers_new: 0, customers_returning: 0 } }), t, f);
    expect(lines).toHaveLength(1);
  });

  it('describes outcomes, peak day, top service, staff, customers, comparison and the cancel warning', () => {
    const lines = buildReportSummary(base(), t, f);
    const text = lines.join('\n');
    expect(text).toContain('มีคิวทั้งหมด 20 คิว');
    expect(text).toContain('เฉลี่ย 2.9 คิวต่อวัน');
    expect(text).toContain('มากที่สุดคือ2026-09-07 (9 คิว)');
    expect(text).toContain('น้อยที่สุดคือ2026-09-06 (2 คิว)');
    expect(text).toContain('"ตัดผม" 11 คิว');
    expect(text).toContain('พี่บอย 8 คิว');
    expect(text).toContain('กลับมาซ้ำ 4 ราย (40%)');
    expect(text).toContain('เพิ่มขึ้น 100%');
    expect(text).toContain('สูงกว่าเกณฑ์ 15%');
  });

  it('uses hourly peak for a single day', () => {
    const lines = buildReportSummary(base({ range: { preset: 'today', from: '2026-09-12', to: '2026-09-12', days: 1, today: '2026-09-12' } }), t, f);
    expect(lines.join('\n')).toContain('หนาแน่นที่สุดคือ 14:00 (7 คิว)');
    expect(lines.join('\n')).not.toContain('เฉลี่ย');
  });

  it('describes the booked queue for upcoming ranges and skips comparison', () => {
    const lines = buildReportSummary(base({ range: { preset: 'tomorrow', from: '2026-09-13', to: '2026-09-13', days: 1, today: '2026-09-12' }, prev: null }), t, f);
    const text = lines.join('\n');
    expect(text).toContain('มีคิวจองล่วงหน้าทั้งหมด 20 คิว');
    expect(text).toContain('รอยืนยัน 3 คิว');
    expect(text).not.toContain('เทียบกับช่วงก่อนหน้า');
    expect(text).not.toContain('สูงกว่าเกณฑ์');
  });
});
