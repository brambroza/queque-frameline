'use client';

import { Box, Chip, Stack, Typography } from '@mui/material';
import { DEMO_PAYMENT_LABELS, formatTHB } from '@/lib/demo/payment-demo';
import type { DemoQueueItem, DemoQueueStatus } from '@/components/demo/line-demo-types';
import type { PaymentStatus } from '@/types/db';

const COLUMNS: Array<{ key: DemoQueueStatus; label: string }> = [
  { key: 'waiting', label: 'Waiting' },
  { key: 'called', label: 'Called' },
  { key: 'serving', label: 'Serving' },
  { key: 'completed', label: 'Completed' },
];

function statusColor(status: DemoQueueStatus) {
  if (status === 'waiting') return 'default';
  if (status === 'called') return 'warning';
  if (status === 'serving') return 'info';
  return 'success';
}

/** Colours for the payment badge staff see on each queue card. */
function paymentChipSx(status: PaymentStatus) {
  if (status === 'paid') return { bgcolor: '#e7f7ee', color: '#0a7043' };
  if (status === 'awaiting_verification') return { bgcolor: '#fef3c7', color: '#92400e' };
  if (status === 'rejected') return { bgcolor: '#ffe4e6', color: '#9f1239' };
  return { bgcolor: '#eef2f7', color: '#475569' };
}

export function DemoQueueBoard({ items }: { items: DemoQueueItem[] }) {
  return (
    <Stack spacing={1.2}>
      <Typography fontWeight={800}>Demo Queue Board</Typography>
      <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: { xs: '1fr', md: 'repeat(4, minmax(0,1fr))' } }}>
        {COLUMNS.map((col) => {
          const rows = items.filter((x) => x.status === col.key);
          return (
            <Box key={col.key} sx={{ border: '1px solid #dce3ea', borderRadius: 1, p: 1.2, bgcolor: '#fbfcfd', minHeight: 160 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                <Typography sx={{ fontWeight: 800 }}>{col.label}</Typography>
                <Chip size="small" label={rows.length} color={statusColor(col.key)} />
              </Stack>
              <Stack spacing={0.8}>
                {rows.length === 0 ? <Typography sx={{ fontSize: 12, color: '#7e8a97' }}>ไม่มีรายการ</Typography> : rows.map((row) => (
                  <Box
                    key={row.id}
                    data-queue-card
                    sx={{
                      border: '1px solid #e2e8ef',
                      borderRadius: 1,
                      p: 1,
                      bgcolor: '#fff',
                      transition: 'transform .2s ease, box-shadow .2s ease',
                      '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 6px 16px rgba(15,40,25,.10)' },
                    }}
                  >
                    <Typography sx={{ fontWeight: 900, fontSize: 20, lineHeight: 1 }}>{row.queueNo}</Typography>
                    <Typography sx={{ fontSize: 13 }}>{row.serviceName}</Typography>
                    <Typography sx={{ fontSize: 12, color: '#687483' }}>{row.timeLabel} • {row.resourceName || row.branchName}</Typography>
                    {(row.amount ?? 0) > 0 ? (
                      <Stack direction="row" spacing={0.6} alignItems="center" sx={{ mt: 0.6 }} flexWrap="wrap" useFlexGap>
                        <Chip
                          size="small"
                          label={DEMO_PAYMENT_LABELS[row.paymentStatus ?? 'pending_payment']}
                          sx={{ ...paymentChipSx(row.paymentStatus ?? 'pending_payment'), fontSize: 11, fontWeight: 700, height: 20 }}
                        />
                        <Typography sx={{ fontSize: 11, color: '#687483' }}>{formatTHB(row.amount)} ฿</Typography>
                      </Stack>
                    ) : null}
                  </Box>
                ))}
              </Stack>
            </Box>
          );
        })}
      </Box>
    </Stack>
  );
}
