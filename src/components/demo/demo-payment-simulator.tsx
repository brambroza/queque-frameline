'use client';

import { useMemo, useState } from 'react';
import { Box, Button, Chip, Stack, TextField, Typography } from '@mui/material';
import QrCode2RoundedIcon from '@mui/icons-material/QrCode2Rounded';
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded';
import {
  DEMO_METHOD_LABELS,
  DEMO_PAYEE,
  DEMO_PAYMENT_LABELS,
  DEMO_REJECT_PRESETS,
  fakeQrBlocks,
  formatTHB,
} from '@/lib/demo/payment-demo';
import type { DemoBooking } from '@/components/demo/line-demo-types';
import type { PaymentMethod, PaymentStatus } from '@/types/db';
import { DEMO_PAYMENT_METHODS } from '@/lib/demo/payment-demo';

/** Non-scannable QR artwork. Labelled so nobody mistakes it for a real code. */
function FakeQr({ seed }: { seed: string }) {
  const blocks = useMemo(() => fakeQrBlocks(seed), [seed]);
  return (
    <Stack alignItems="center" spacing={0.6}>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: `repeat(${blocks.length}, 1fr)`,
          width: 168,
          height: 168,
          p: 1,
          borderRadius: 1.5,
          bgcolor: '#fff',
          border: '1px solid #d8dfe7',
        }}
      >
        {blocks.flatMap((row, r) =>
          row.map((on, c) => (
            <Box key={`${r}-${c}`} sx={{ bgcolor: on ? '#0f172a' : 'transparent' }} />
          )),
        )}
      </Box>
      <Chip size="small" label="QR ตัวอย่าง — สแกนไม่ได้" sx={{ bgcolor: '#f1f5f9', color: '#64748b', fontSize: 11 }} />
    </Stack>
  );
}

function StatusChip({ status }: { status: PaymentStatus }) {
  const color =
    status === 'paid' ? { bg: '#e7f7ee', fg: '#0a7043' }
      : status === 'awaiting_verification' ? { bg: '#fef3c7', fg: '#92400e' }
        : status === 'rejected' ? { bg: '#ffe4e6', fg: '#9f1239' }
          : { bg: '#eef2f7', fg: '#475569' };
  return <Chip size="small" label={DEMO_PAYMENT_LABELS[status]} sx={{ bgcolor: color.bg, color: color.fg, fontWeight: 700 }} />;
}

/**
 * STEP 3 of the sandbox: what the customer sees between confirming a booking
 * and being called. Covers both payment paths the product supports —
 * `omise_promptpay` (auto-verified by webhook) and `bank_transfer` (a slip the
 * shop reviews by hand) — with the shop-side review shown inline so a visitor
 * understands who does what.
 *
 * Everything is local state. No API call, no Omise, no money.
 */
export function DemoPaymentSimulator({
  booking,
  onMethodChange,
  onSlipUploaded,
  onPaid,
  onRejected,
}: {
  booking: DemoBooking;
  onMethodChange: (method: PaymentMethod) => void;
  onSlipUploaded: () => void;
  onPaid: () => void;
  onRejected: (reason: string) => void;
}) {
  const [rejectReason, setRejectReason] = useState<string>(DEMO_REJECT_PRESETS[0]);
  const method = booking.paymentMethod ?? 'omise_promptpay';
  const status = booking.paymentStatus ?? 'pending_payment';
  const amount = booking.amount ?? 0;
  const paid = status === 'paid';

  if (amount <= 0) {
    return (
      <Box sx={{ border: '1px dashed #c6d5e2', borderRadius: 1, p: 2.2, textAlign: 'center', color: '#586677' }}>
        บริการนี้ไม่เก็บเงินล่วงหน้า — ร้านที่ไม่เปิดรับชำระเงินจะข้ามขั้นตอนนี้ไปเลย
      </Box>
    );
  }

  return (
    <Stack spacing={1.4}>
      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
        <Typography sx={{ fontSize: 13, color: '#637182' }}>คิว {booking.queueNo}</Typography>
        <StatusChip status={status} />
      </Stack>

      {/* Method switch — the whole point is seeing both paths without a reset. */}
      <Stack direction="row" spacing={1}>
        {DEMO_PAYMENT_METHODS.map((m) => (
          <Button
            key={m}
            fullWidth
            size="small"
            variant={m === method ? 'contained' : 'outlined'}
            startIcon={m === 'omise_promptpay' ? <QrCode2RoundedIcon /> : <ReceiptLongRoundedIcon />}
            onClick={() => onMethodChange(m)}
            sx={{
              borderRadius: 1,
              bgcolor: m === method ? '#12a862' : undefined,
              '&:hover': m === method ? { bgcolor: '#5ead77' } : undefined,
            }}
          >
            {DEMO_METHOD_LABELS[m].title}
          </Button>
        ))}
      </Stack>
      <Typography sx={{ fontSize: 12, color: '#637182' }}>{DEMO_METHOD_LABELS[method].hint}</Typography>

      <Box sx={{ borderRadius: 1, border: '1px solid #e2e8ef', bgcolor: '#fff', p: 1.6 }}>
        <Stack alignItems="center" spacing={0.3} sx={{ mb: 1.2 }}>
          <Typography sx={{ fontSize: 12, color: '#7f8b98' }}>ยอดที่ต้องชำระ</Typography>
          <Typography sx={{ fontSize: 30, fontWeight: 900, color: paid ? '#0a7043' : '#12a862', lineHeight: 1.1 }}>
            {formatTHB(amount)} บาท
          </Typography>
          {!paid ? <Typography sx={{ fontSize: 12, color: '#7f8b98' }}>เหลือเวลา 23 ชม. 59 นาที</Typography> : null}
        </Stack>

        {paid ? (
          <Stack alignItems="center" spacing={0.6} sx={{ borderRadius: 1, bgcolor: '#f0fdf4', border: '1px solid #bbf7d0', py: 2 }}>
            <Typography sx={{ fontSize: 34, color: '#16a34a', lineHeight: 1 }}>✓</Typography>
            <Typography sx={{ fontWeight: 800, color: '#15803d' }}>ชำระเงินเรียบร้อยแล้ว</Typography>
            <Typography sx={{ fontSize: 12, color: '#15803d' }}>
              {method === 'omise_promptpay' ? 'ระบบยืนยันอัตโนมัติจากผู้ให้บริการชำระเงิน' : 'ร้านอนุมัติสลิปแล้ว'}
            </Typography>
          </Stack>
        ) : method === 'omise_promptpay' ? (
          <Stack spacing={1.2} alignItems="center">
            <FakeQr seed={`${booking.queueNo}-${amount}`} />
            <Typography sx={{ fontSize: 12, color: '#7f8b98' }}>สแกนด้วยแอปธนาคารเพื่อโอนเงิน</Typography>
            <Button
              fullWidth
              variant="contained"
              onClick={onPaid}
              sx={{ borderRadius: 1, bgcolor: '#12a862', '&:hover': { bgcolor: '#5ead77' } }}
            >
              จำลองสแกนจ่ายสำเร็จ
            </Button>
            <Typography sx={{ fontSize: 11, color: '#94a3b8', textAlign: 'center' }}>
              ของจริงระบบจะรับผลจาก webhook แล้วอัปเดตสถานะให้เองโดยลูกค้าไม่ต้องทำอะไรเพิ่ม
            </Typography>
          </Stack>
        ) : (
          <Stack spacing={1.2}>
            <Box sx={{ borderRadius: 1, bgcolor: '#f8fafc', border: '1px solid #e2e8f0', p: 1.2 }}>
              <Typography sx={{ fontSize: 12, color: '#475569' }}>ผู้รับ: <b>{DEMO_PAYEE.promptpayDisplayName}</b></Typography>
              <Typography sx={{ fontSize: 12, color: '#475569' }}>PromptPay: {DEMO_PAYEE.promptpayMasked}</Typography>
              <Typography sx={{ fontSize: 12, color: '#475569' }}>{DEMO_PAYEE.bankName} {DEMO_PAYEE.bankAccountNo}</Typography>
              <Typography sx={{ fontSize: 12, color: '#475569' }}>ชื่อบัญชี: {DEMO_PAYEE.bankAccountName}</Typography>
            </Box>

            {status === 'rejected' ? (
              <Box sx={{ borderRadius: 1, bgcolor: '#fff1f2', border: '1px solid #fecdd3', p: 1.2 }}>
                <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#9f1239' }}>สลิปไม่ผ่านการตรวจสอบ</Typography>
                <Typography sx={{ fontSize: 12, color: '#9f1239' }}>กรุณาอัปโหลดสลิปใหม่อีกครั้ง</Typography>
              </Box>
            ) : null}

            {status === 'awaiting_verification' ? (
              <Box sx={{ borderRadius: 1, bgcolor: '#fffbeb', border: '1px solid #fde68a', p: 1.2 }}>
                <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#92400e' }}>รอร้านตรวจสอบสลิป</Typography>
                <Typography sx={{ fontSize: 12, color: '#92400e' }}>ร้านจะแจ้งผลกลับทาง LINE</Typography>
              </Box>
            ) : (
              <Button
                fullWidth
                variant="contained"
                onClick={onSlipUploaded}
                sx={{ borderRadius: 1, bgcolor: '#12a862', '&:hover': { bgcolor: '#5ead77' } }}
              >
                จำลองอัปโหลดสลิป
              </Button>
            )}
          </Stack>
        )}
      </Box>

      {/* Shop side. Only meaningful while a slip is actually waiting. */}
      {method === 'bank_transfer' && status === 'awaiting_verification' ? (
        <Box sx={{ borderRadius: 1, border: '1px solid #cbd5e1', bgcolor: '#f8fafc', p: 1.4 }}>
          <Typography sx={{ fontWeight: 800, fontSize: 14, mb: 0.3 }}>ฝั่งร้าน: ตรวจสอบสลิป</Typography>
          <Typography sx={{ fontSize: 12, color: '#64748b', mb: 1 }}>
            ของจริงพนักงานทำที่หน้า “ตรวจสอบสลิป” ในระบบหลังร้าน
          </Typography>
          <TextField
            select
            size="small"
            fullWidth
            label="เหตุผลเมื่อปฏิเสธ"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            SelectProps={{ native: true }}
            sx={{ mb: 1 }}
          >
            {DEMO_REJECT_PRESETS.map((preset) => (
              <option key={preset} value={preset}>{preset}</option>
            ))}
          </TextField>
          <Stack direction="row" spacing={1}>
            <Button fullWidth variant="outlined" color="error" sx={{ borderRadius: 1 }} onClick={() => onRejected(rejectReason)}>
              ปฏิเสธสลิป
            </Button>
            <Button
              fullWidth
              variant="contained"
              sx={{ borderRadius: 1, bgcolor: '#12a862', '&:hover': { bgcolor: '#5ead77' } }}
              onClick={onPaid}
            >
              อนุมัติ
            </Button>
          </Stack>
        </Box>
      ) : null}
    </Stack>
  );
}
