'use client';

import { Box, Stack, Typography } from '@mui/material';
import type { DemoQueueItem } from '@/components/demo/line-demo-types';

export function DemoSignage({ items }: { items: DemoQueueItem[] }) {
  const nowCalling = items.find((x) => x.status === 'called') ?? null;
  const nextQueues = items.filter((x) => x.status === 'waiting').slice(0, 3);
  const waiting = items.filter((x) => x.status === 'waiting');

  return (
    <Box sx={{ borderRadius: 1, bgcolor: '#0f1411', color: '#d8ffe2', border: '1px solid #1f3528', p: 2 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography sx={{ fontWeight: 900 }}>Digital Signage</Typography>
        <Typography sx={{ fontSize: 12, color: '#7bd19d' }}>Demo Mode</Typography>
      </Stack>

      <Box sx={{ mt: 1.5, borderRadius: 1, border: '1px solid #224230', bgcolor: '#101a13', p: 1.6 }}>
        <Typography sx={{ fontSize: 12, color: '#86c89f' }}>NOW CALLING</Typography>
        <Typography sx={{ fontSize: 52, fontWeight: 900, color: '#7ef9a7', lineHeight: 1 }}>
          {nowCalling?.queueNo ?? '-'}
        </Typography>
        <Typography>{nowCalling ? `${nowCalling.serviceName} • ${nowCalling.resourceName || nowCalling.branchName}` : 'ยังไม่มีคิวที่เรียกอยู่'}</Typography>
      </Box>

      <Stack spacing={1.1} sx={{ mt: 1.6 }}>
        <Typography sx={{ fontSize: 12, color: '#86c89f' }}>NEXT QUEUE</Typography>
        {nextQueues.length === 0 ? <Typography sx={{ color: '#a5ccb2' }}>ไม่มีคิวรอเรียก</Typography> : nextQueues.map((q) => (
          <Stack key={q.id} direction="row" justifyContent="space-between" sx={{ borderRadius: 2, bgcolor: '#16221a', px: 1.2, py: 0.8 }}>
            <Typography sx={{ fontWeight: 800 }}>{q.queueNo}</Typography>
            <Typography sx={{ color: '#a5ccb2' }}>{q.timeLabel}</Typography>
          </Stack>
        ))}
      </Stack>

      <Typography sx={{ mt: 1.5, fontSize: 12, color: '#86c89f' }}>Waiting Queue: {waiting.length}</Typography>
    </Box>
  );
}
