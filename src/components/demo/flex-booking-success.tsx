'use client';

import { Box, Button, Chip, Stack, Typography } from '@mui/material';
import { DEMO_PAYMENT_LABELS, formatTHB } from '@/lib/demo/payment-demo';
import type { DemoBooking } from '@/components/demo/line-demo-types';

function resourceLabelByService(serviceName?: string) {
  const name = (serviceName || '').toLowerCase();
  if (name.includes('ตัดผม') || name.includes('สระ') || name.includes('เล็บ') || name.includes('barber') || name.includes('nail')) return 'ช่าง';
  if (name.includes('ห้องประชุม') || name.includes('meeting')) return 'ห้อง';
  if (name.includes('บุฟเฟ่ต์') || name.includes('ร้านอาหาร') || name.includes('โต๊ะ') || name.includes('buffet') || name.includes('restaurant')) return 'โต๊ะ';
  return 'Resource';
}

export function FlexBookingSuccess({
  booking,
  onAction,
}: {
  booking: DemoBooking;
  onAction?: (action: 'my_queue' | 'cancel' | 'open_liff') => void;
}) {
  const resourceLabel = resourceLabelByService(booking.serviceName);
  return (
    <Box
      sx={{
        width: '100%',
        maxWidth: 380,
        overflow: 'hidden',
        borderRadius: 3,
        bgcolor: '#fff',
        border: '1px solid #d9e2ea',
      }}
    >
      <Box sx={{ bgcolor: '#12a862', px: 2, py: 1.6 }}>
        <Typography sx={{ color: '#f2fff4', fontSize: 13 }}>queue booking</Typography>
        <Typography sx={{ color: '#fff', fontSize: 32, fontWeight: 800, lineHeight: 1.05 }}>จองคิวสำเร็จ</Typography>
      </Box>
      <Stack spacing={1} sx={{ p: 2 }}>
        <Typography sx={{ fontSize: 38, fontWeight: 900, color: '#142030', lineHeight: 1 }}>เลขคิว {booking.queueNo}</Typography>
        <Typography>สาขา: {booking.branchName}</Typography>
        <Typography>บริการ: {booking.serviceName}</Typography>
        {booking.resourceName ? <Typography>{resourceLabel}: {booking.resourceName}</Typography> : null}
        <Typography>วันที่: {booking.dateLabel}</Typography>
        <Typography>เวลา: {booking.timeLabel}</Typography>
        {(booking.amount ?? 0) > 0 ? (
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            <Typography>ยอดชำระ: {formatTHB(booking.amount)} บาท</Typography>
            <Chip
              size="small"
              label={DEMO_PAYMENT_LABELS[booking.paymentStatus ?? 'pending_payment']}
              sx={{
                fontWeight: 700,
                bgcolor: booking.paymentStatus === 'paid' ? '#e7f7ee' : '#eef2f7',
                color: booking.paymentStatus === 'paid' ? '#0a7043' : '#475569',
              }}
            />
          </Stack>
        ) : null}
        <Box sx={{ borderRadius: 2, bgcolor: '#f2f4f7', px: 1.6, py: 1, color: '#546171' }}>
          กรุณามาก่อนเวลาประมาณ 10 นาที
        </Box>
        <Button onClick={() => onAction?.('my_queue')} fullWidth variant="contained" sx={{ bgcolor: '#dfe3e9', color: '#2b3440', boxShadow: 'none' }}>
          ดูคิวของฉัน
        </Button>
        <Button onClick={() => onAction?.('cancel')} fullWidth variant="contained" sx={{ bgcolor: '#dfe3e9', color: '#2b3440', boxShadow: 'none' }}>
          ยกเลิกคิว
        </Button>
        <Button onClick={() => onAction?.('open_liff')} fullWidth variant="contained" sx={{ bgcolor: '#12a862', color: '#fff', boxShadow: 'none', '&:hover': { bgcolor: '#5ead77' } }}>
          เปิด LIFF อีกครั้ง
        </Button>
      </Stack>
    </Box>
  );
}
