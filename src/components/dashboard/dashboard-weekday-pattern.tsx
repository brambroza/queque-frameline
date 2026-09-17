'use client';

import { Box, Card, CardContent, Stack, Typography } from '@mui/material';
import { useTranslation } from '@/lib/i18n/useTranslation';
import type { DashboardWeekdayPattern } from '@/types/dashboard';
import { weekdayName, weekdayOfISO } from './dashboard-utils';

const ORDER = [1, 2, 3, 4, 5, 6, 0];

/**
 * Average utilization per weekday over the last 8 full weeks. Independent of the
 * selected range so the manager can see which days are chronically quiet.
 */
export function DashboardWeekdayPattern({ pattern, today }: { pattern: DashboardWeekdayPattern[]; today: string }) {
  const { t } = useTranslation('dashboard');
  const todayWeekday = weekdayOfISO(today);
  const byWeekday = new Map(pattern.map((p) => [p.weekday, p]));
  const hasData = pattern.some((p) => p.weeks > 0);

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Typography fontWeight={700}>{t('weekday_pattern', 'รูปแบบรายสัปดาห์')}</Typography>
        <Typography variant="caption" color="text.secondary" display="block" mb={1.5}>
          {t('weekday_pattern_hint', 'ความหนาแน่นเฉลี่ยแต่ละวัน · 8 สัปดาห์ล่าสุด · ไม่ขึ้นกับช่วงที่เลือก')}
        </Typography>
        {!hasData ? (
          <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
            {t('weekday_pattern_empty', 'ยังไม่มีข้อมูลย้อนหลังพอสำหรับวิเคราะห์')}
          </Typography>
        ) : (
          <Box sx={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: '10px 12px', alignItems: 'center' }}>
            {ORDER.map((w) => {
              const p = byWeekday.get(w);
              const util = p?.avg_utilization_pct ?? 0;
              const isToday = w === todayWeekday;
              const barColor = util < 50 ? 'warning.main' : 'primary.main';
              return (
                <Stack key={w} direction="row" sx={{ display: 'contents' }}>
                  <Typography variant="body2" sx={{ color: isToday ? 'primary.dark' : 'text.secondary', fontWeight: isToday ? 700 : 400, whiteSpace: 'nowrap' }}>
                    {weekdayName(t, w)}
                    {isToday ? ` · ${t('range_today', 'วันนี้')}` : ''}
                  </Typography>
                  <Box
                    sx={{
                      position: 'relative',
                      height: 10,
                      borderRadius: 5,
                      bgcolor: 'action.hover',
                      overflow: 'hidden',
                      outline: isToday ? '2px solid' : 'none',
                      outlineColor: 'primary.main',
                      outlineOffset: 1,
                    }}
                    role="img"
                    aria-label={`${weekdayName(t, w)} ${util}%`}
                  >
                    <Box sx={{ position: 'absolute', inset: 0, width: `${Math.min(100, util)}%`, borderRadius: 5, bgcolor: barColor }} />
                  </Box>
                  <Typography variant="body2" fontWeight={isToday ? 700 : 600} sx={{ minWidth: 40, textAlign: 'right', color: isToday ? 'primary.dark' : 'text.primary' }}>
                    {util}%
                  </Typography>
                </Stack>
              );
            })}
          </Box>
        )}
      </CardContent>
    </Card>
  );
}
