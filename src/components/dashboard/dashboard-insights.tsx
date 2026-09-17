'use client';

import { Box, Button, Card, CardContent, Stack, Typography } from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import { useTranslation } from '@/lib/i18n/useTranslation';
import type { Insight } from '@/types/dashboard';
import { fmt, hourLabel, shortThaiDate, weekdayName } from './dashboard-utils';

type Rendered = { icon: string; tone: 'error' | 'info' | 'primary' | 'warning'; title: string; detail: string; action?: { label: string; href?: string; onClick?: () => void } };

/**
 * Rule-based insights rendered as short, actionable cards. Copy comes from the
 * `dashboard.insight_*` keys with `{{placeholders}}` filled from the insight.
 */
export function DashboardInsights({ insights, today, onShowTimeline }: { insights: Insight[]; today: string; onShowTimeline: () => void }) {
  const { t } = useTranslation('dashboard');
  const theme = useTheme();

  const render = (i: Insight): Rendered => {
    switch (i.kind) {
      case 'peak':
        return {
          icon: '🔥',
          tone: 'error',
          title: fmt(t('insight_peak', 'ช่วงแน่นสุด: วัน{{weekday}} {{from}}–{{to}} เฉลี่ย {{pct}}% ของความจุ'), {
            weekday: weekdayName(t, i.weekday),
            from: hourLabel(i.hour),
            to: hourLabel(i.hour + 1),
            pct: i.utilization_pct,
          }),
          detail: t('insight_peak_detail', 'เฉลี่ย 8 สัปดาห์ · จัดพนักงานให้ครบและลดการรับ walk-in ในช่วงนี้'),
          action: { label: t('view_timeline', 'ดูช่วงเวลา'), onClick: onShowTimeline },
        };
      case 'low': {
        const dayLabel = i.date === today ? t('range_today', 'วันนี้') : shortThaiDate(i.date);
        const hasRun = i.free_from_hour !== null && i.free_to_hour !== null;
        return {
          icon: '🧊',
          tone: 'info',
          title: fmt(t('insight_low', '{{day}} (วัน{{weekday}}) คิวเพียง {{pct}}% ต่ำกว่าค่าเฉลี่ยวัน{{weekday}} ({{base}}%) อยู่ {{gap}} จุด'), {
            day: dayLabel,
            weekday: weekdayName(t, i.weekday),
            pct: i.utilization_pct,
            base: i.baseline_pct,
            gap: i.baseline_pct - i.utilization_pct,
          }),
          detail: hasRun
            ? fmt(t('insight_low_detail', 'ว่างต่อเนื่อง {{from}}–{{to}} รวม {{slots}} slot · ลองส่ง LINE broadcast โปรฯ ช่วงนี้ หรือโยกคิวจากวันแน่นมาใส่'), {
                from: hourLabel(i.free_from_hour ?? 0),
                to: hourLabel(i.free_to_hour ?? 0),
                slots: i.free_slots,
              })
            : t('insight_low_no_run', 'ไม่มีช่วงว่างต่อเนื่อง'),
          action: { label: t('open_bookings', 'เปิดรายการคิว'), href: i.link },
        };
      }
      case 'movable': {
        const dayLabel = i.date === today ? t('range_today', 'วันนี้') : shortThaiDate(i.date);
        const targetLabel = i.target_date === today ? t('range_today', 'วันนี้') : shortThaiDate(i.target_date);
        const hasTarget = i.target_from_hour !== null && i.target_to_hour !== null;
        return {
          icon: '🔁',
          tone: 'primary',
          title: fmt(t('insight_movable', '{{day}} {{hour}} มีคิว {{count}} เต็มความจุ {{capacity}}'), {
            day: dayLabel,
            hour: hourLabel(i.hour),
            count: i.count,
            capacity: i.capacity,
          }),
          detail: hasTarget
            ? fmt(t('insight_movable_detail', '{{target}}ยังว่างช่วง {{from}}–{{to}} · ติดต่อลูกค้าที่ยัง "รอยืนยัน" เสนอเลื่อนมา{{target}}'), {
                target: targetLabel,
                from: hourLabel(i.target_from_hour ?? 0),
                to: hourLabel(i.target_to_hour ?? 0),
              })
            : t('insight_movable_no_target', 'ยังไม่มีช่วงว่างให้โยก'),
          action: { label: t('open_bookings', 'เปิดรายการคิว'), href: i.link },
        };
      }
      case 'pattern':
        return {
          icon: '📅',
          tone: 'warning',
          title: fmt(t('insight_pattern', 'วัน{{days}} ว่างเป็นประจำ (เฉลี่ย {{pcts}}) ใน {{weeks}} สัปดาห์ล่าสุด'), {
            days: i.weekdays.map((w) => weekdayName(t, w)).join(` ${t('and', 'และ')} `),
            pcts: i.utilization_pcts.map((p) => `${p}%`).join(', '),
            weeks: i.weeks,
          }),
          detail: t('insight_pattern_detail', 'เหมาะทำโปรโมชั่นเฉพาะวัน หรือลดจำนวนพนักงานประจำวันนั้นเพื่อคุมต้นทุน'),
        };
      case 'cancel_rate':
        return {
          icon: '⚠️',
          tone: 'error',
          title: fmt(
            i.rate_pct - i.prev_rate_pct >= 5
              ? t('insight_cancel_jump', 'ยกเลิก + ไม่มา {{pct}}% สูงขึ้น {{gap}} จุดจากช่วงก่อน')
              : t('insight_cancel', 'ยกเลิก + ไม่มา {{pct}}% (เกณฑ์ 15%)'),
            { pct: i.rate_pct, gap: i.rate_pct - i.prev_rate_pct },
          ),
          detail: t('insight_cancel_detail', 'พิจารณาเปิดมัดจำล่วงหน้า หรือส่ง LINE เตือนก่อนถึงคิว'),
          action: { label: t('open_line_settings', 'ตั้งค่าการเตือน'), href: i.link },
        };
    }
  };

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Typography fontWeight={700}>{t('insights_title', 'สิ่งที่ควรดู')}</Typography>
        <Typography variant="caption" color="text.secondary" display="block" mb={1.5}>
          {t('insights_hint', 'วิเคราะห์อัตโนมัติจากคิวในช่วงที่เลือก เทียบกับรูปแบบ 8 สัปดาห์ล่าสุด')}
        </Typography>
        {insights.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center', border: '1px dashed', borderColor: 'divider', borderRadius: 2 }}>
            {t('insights_empty', 'ช่วงนี้ไม่มีจุดผิดปกติ — คิวใกล้เคียงรูปแบบปกติ')}
          </Typography>
        ) : (
          <Stack spacing={1}>
            {insights.map((raw, idx) => {
              const i = render(raw);
              const main = theme.palette[i.tone].main;
              return (
                <Stack
                  key={`${raw.kind}-${idx}`}
                  direction="row"
                  spacing={1.25}
                  alignItems="flex-start"
                  sx={{ p: 1.25, borderRadius: 2, border: '1px solid', borderColor: 'divider', bgcolor: 'background.default' }}
                >
                  <Box sx={{ flexShrink: 0, width: 30, height: 30, borderRadius: 1.5, display: 'grid', placeItems: 'center', bgcolor: alpha(main, 0.12), fontSize: 15 }} aria-hidden>
                    {i.icon}
                  </Box>
                  <Stack spacing={0.25} sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" fontWeight={600}>{i.title}</Typography>
                    <Typography variant="caption" color="text.secondary">{i.detail}</Typography>
                  </Stack>
                  {i.action ? (
                    <Button size="small" variant="outlined" sx={{ flexShrink: 0, alignSelf: 'center' }} href={i.action.href} onClick={i.action.onClick}>
                      {i.action.label}
                    </Button>
                  ) : null}
                </Stack>
              );
            })}
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}
