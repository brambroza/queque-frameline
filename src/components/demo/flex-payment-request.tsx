'use client';

import { Box, Stack, Typography } from '@mui/material';
import { DEMO_METHOD_LABELS, DEMO_PAYEE, formatTHB } from '@/lib/demo/payment-demo';
import type { DemoBooking } from '@/components/demo/line-demo-types';

/**
 * MUI stand-ins for the payment Flex messages the real bot pushes
 * (`src/lib/line/messages-payment.ts`). Same headline wording and layout so the
 * sandbox looks like the LINE chat a customer would actually receive.
 */

/** "ชำระเงิน" / "โอนเงิน + แนบสลิป" — the invoice card. */
export function FlexPaymentRequest({ booking }: { booking: DemoBooking }) {
  const method = booking.paymentMethod ?? 'omise_promptpay';
  const isQr = method === 'omise_promptpay';

  return (
    <Box sx={{ width: '100%', maxWidth: 380, borderRadius: 3, overflow: 'hidden', bgcolor: '#fff', border: '1px solid #d9e2ea' }}>
      <Box sx={{ bgcolor: isQr ? '#1d4ed8' : '#0f766e', px: 2, py: 1.6 }}>
        <Typography sx={{ color: '#ffffff99', fontSize: 13 }}>queue booking</Typography>
        <Typography sx={{ color: '#fff', fontSize: 26, fontWeight: 800, lineHeight: 1.1 }}>
          {isQr ? 'ชำระเงิน' : 'โอนเงิน + แนบสลิป'}
        </Typography>
      </Box>

      <Stack spacing={0.7} sx={{ p: 2 }}>
        <Typography sx={{ fontWeight: 900, fontSize: 20, color: '#111827' }}>คิว {booking.queueNo}</Typography>
        <Typography sx={{ fontSize: 14, color: '#374151' }}>บริการ: {booking.serviceName}</Typography>
        <Typography sx={{ fontSize: 14, color: '#374151' }}>สาขา: {booking.branchName}</Typography>
        <Typography sx={{ fontSize: 14, color: '#374151' }}>{booking.dateLabel} {booking.timeLabel}</Typography>

        <Box sx={{ mt: 1, borderRadius: 2, bgcolor: '#f3f4f6', px: 1.6, py: 1.2, textAlign: 'center' }}>
          <Typography sx={{ fontSize: 12, color: '#6b7280' }}>ยอดที่ต้องชำระ</Typography>
          <Typography sx={{ fontSize: 28, fontWeight: 900, color: isQr ? '#1d4ed8' : '#0f766e' }}>
            {formatTHB(booking.amount)} บาท
          </Typography>
        </Box>

        {!isQr ? (
          <Box sx={{ borderRadius: 2, bgcolor: '#f8fafc', px: 1.4, py: 1, border: '1px solid #e2e8f0' }}>
            <Typography sx={{ fontSize: 12, color: '#374151' }}>ผู้รับ: {DEMO_PAYEE.promptpayDisplayName}</Typography>
            <Typography sx={{ fontSize: 12, color: '#374151' }}>PromptPay: {DEMO_PAYEE.promptpayMasked}</Typography>
            <Typography sx={{ fontSize: 12, color: '#374151' }}>{DEMO_PAYEE.bankName} {DEMO_PAYEE.bankAccountNo}</Typography>
          </Box>
        ) : null}

        <Typography sx={{ fontSize: 12, color: '#4b5563' }}>{DEMO_METHOD_LABELS[method].hint}</Typography>
      </Stack>
    </Box>
  );
}

/** "ชำระเงินสำเร็จ" — the receipt card. */
export function FlexPaymentPaid({ booking }: { booking: DemoBooking }) {
  return (
    <Box sx={{ width: '100%', maxWidth: 380, borderRadius: 3, overflow: 'hidden', bgcolor: '#fff', border: '1px solid #d9e2ea' }}>
      <Box sx={{ bgcolor: '#16a34a', px: 2, py: 1.6 }}>
        <Typography sx={{ color: '#ffffff99', fontSize: 13 }}>queue booking</Typography>
        <Typography sx={{ color: '#fff', fontSize: 26, fontWeight: 800, lineHeight: 1.1 }}>ชำระเงินสำเร็จ</Typography>
      </Box>

      <Stack spacing={0.7} sx={{ p: 2 }}>
        <Typography sx={{ fontSize: 40, fontWeight: 900, color: '#16a34a', lineHeight: 1, textAlign: 'center' }}>✓</Typography>
        <Typography sx={{ fontSize: 14, fontWeight: 800, color: '#111827' }}>ใบเสร็จรับเงิน (ตัวอย่าง)</Typography>
        <Typography sx={{ fontSize: 14, color: '#374151' }}>คิว: {booking.queueNo}</Typography>
        <Typography sx={{ fontSize: 14, color: '#374151' }}>บริการ: {booking.serviceName}</Typography>
        <Typography sx={{ fontSize: 14, color: '#374151' }}>วันที่: {booking.dateLabel} {booking.timeLabel}</Typography>

        <Stack direction="row" justifyContent="space-between" sx={{ mt: 1, borderTop: '1px solid #e5e7eb', pt: 1 }}>
          <Typography sx={{ fontSize: 15, fontWeight: 800, color: '#111827' }}>ยอดชำระ</Typography>
          <Typography sx={{ fontSize: 15, fontWeight: 800, color: '#16a34a' }}>{formatTHB(booking.amount)} บาท</Typography>
        </Stack>

        <Box sx={{ borderRadius: 2, bgcolor: '#f0fdf4', px: 1.4, py: 0.9 }}>
          <Typography sx={{ fontSize: 12, color: '#15803d', textAlign: 'center' }}>ขอบคุณที่ใช้บริการค่ะ</Typography>
        </Box>
      </Stack>
    </Box>
  );
}
