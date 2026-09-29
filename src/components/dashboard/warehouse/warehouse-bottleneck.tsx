'use client';

import { Box, Stack, Tooltip, Typography } from '@mui/material';
import { useTranslation } from '@/lib/i18n/useTranslation';
import type { DashboardWarehouse } from '@/types/dashboard';
import { hourLabel } from '../dashboard-utils';
import { Panel } from './warehouse-ui';

/** Upper bounds (minutes, exclusive) of the first four colour steps; the fifth is open-ended. */
const STEPS = [5, 10, 20, 30];
/** One hue, light to dark. Text flips to white from the fourth step. */
const FILL = ['#e6f2ea', '#bfe0cb', '#86c3a0', '#3f9670', '#0f5f43'];

function stepOf(minutes: number): number {
  const i = STEPS.findIndex((limit) => minutes < limit);
  return i === -1 ? STEPS.length : i;
}

/** Average yard wait per dock and booked hour. */
export function WarehouseBottleneck({ warehouse }: { warehouse: DashboardWarehouse }) {
  const { t } = useTranslation('dashboard');
  const { hours, rows } = warehouse.bottleneck;
  const min = t('unit_minute', 'นาที');
  const labels = [`< ${STEPS[0]}`, `${STEPS[0]}–${STEPS[1] - 1}`, `${STEPS[1]}–${STEPS[2] - 1}`, `${STEPS[2]}–${STEPS[3] - 1}`, `${STEPS[3]}+`];

  return (
    <Panel title={t('wh_bottleneck', 'เวลารอตามชั่วโมง')} action={<Typography variant="caption" color="text.secondary">{min}</Typography>}>
      {rows.length === 0 || hours.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>{t('empty_range', 'ไม่มีข้อมูลในช่วงนี้')}</Typography>
      ) : (
        <>
          <Box sx={{ overflowX: 'auto' }}>
            <Box sx={{ display: 'grid', gap: '2px', minWidth: 520, gridTemplateColumns: `auto repeat(${hours.length}, minmax(40px, 1fr))`, alignItems: 'center' }}>
              <Box />
              {hours.map((h) => (
                <Typography key={h} variant="caption" color="text.secondary" textAlign="center" sx={{ fontSize: 11 }}>{hourLabel(h)}</Typography>
              ))}
              {rows.map((row) => (
                <Box key={row.dock_id} sx={{ display: 'contents' }}>
                  <Typography variant="body2" color="text.secondary" noWrap sx={{ pr: 1 }}>{row.name}</Typography>
                  {row.cells.map((c) =>
                    c.avg_wait_min == null ? (
                      <Box key={c.hour} sx={{ height: 32, borderRadius: 1, border: '1px dashed', borderColor: 'divider' }} />
                    ) : (
                      <Tooltip key={c.hour} arrow title={`${row.name} · ${hourLabel(c.hour)} · ${c.avg_wait_min} ${min} · ${c.count} ${t('wh_trucks', 'คัน')}`}>
                        <Box data-pop tabIndex={0} sx={{ height: 32, borderRadius: 1, display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 600, bgcolor: FILL[stepOf(c.avg_wait_min)], color: stepOf(c.avg_wait_min) >= 3 ? '#fff' : '#06241a' }}>
                          {c.avg_wait_min}
                        </Box>
                      </Tooltip>
                    ),
                  )}
                </Box>
              ))}
            </Box>
          </Box>
          <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap mt={1.5}>
            {labels.map((label, i) => (
              <Typography key={label} variant="caption" color="text.secondary">
                <Box component="span" sx={{ display: 'inline-block', width: 18, height: 10, borderRadius: 0.5, bgcolor: FILL[i], mr: 0.5 }} />
                {label}
              </Typography>
            ))}
          </Stack>
        </>
      )}
    </Panel>
  );
}
