'use client';

import { useMemo, useState } from 'react';
import { Box, Button, Stack, TextField, Typography } from '@mui/material';
import { DEMO_METHOD_LABELS, DEMO_PAYMENT_METHODS, formatTHB } from '@/lib/demo/payment-demo';
import type { DemoBooking } from '@/components/demo/line-demo-types';
import type { PaymentMethod } from '@/types/db';

type Service = { id: string; icon: string; name: string; duration: string; mode: string; price: number };

const SERVICES: Service[] = [
  { id: 'haircut', icon: '💈', name: 'ตัดผมชาย', duration: '30 นาที', mode: 'จองตามเวลาที่เลือกเอง', price: 300 },
  { id: 'buffet', icon: '🍽️', name: 'จองรอบบุฟเฟ่ต์', duration: '120 นาที', mode: 'รับจำนวนตามรอบ', price: 599 },
  { id: 'meeting', icon: '🏢', name: 'จองห้องประชุม', duration: '120 นาที', mode: 'จองรายชั่วโมง', price: 1200 },
];

const TIMES = ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00'];

export function LiffBookingSimulator({
  onBooked,
}: {
  onBooked: (booking: DemoBooking) => void;
}) {
  const [step, setStep] = useState<1 | 2>(1);
  const [customerName, setCustomerName] = useState('ลูกค้าประจำ');
  const [phone, setPhone] = useState('0856083298');
  const [serviceId, setServiceId] = useState('haircut');
  const [date, setDate] = useState(() => {
    const nextDay = new Date();
    nextDay.setDate(nextDay.getDate() + 1);
    return nextDay.toISOString().slice(0, 10);
  });
  const [selectedTime, setSelectedTime] = useState('10:30');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('omise_promptpay');

  const selected = useMemo(() => SERVICES.find((s) => s.id === serviceId) ?? SERVICES[0], [serviceId]);
  // Mirrors the real LIFF rule (`liff-booking-client.tsx`): the picker only
  // appears once there is an amount to collect.
  const showMethodPicker = selected.price > 0;
  const selectedResourceName = useMemo(() => {
    if (serviceId === 'haircut') return 'ช่างบอส';
    if (serviceId === 'buffet') return 'โต๊ะ T02';
    if (serviceId === 'meeting') return 'ROOM-A';
    return undefined;
  }, [serviceId]);

  function handleConfirm() {
    onBooked({
      queueNo: `A${Math.floor(Math.random() * 900 + 100)}`,
      branchName: 'ประชาอุทิศ',
      serviceName: selected.name,
      resourceName: selectedResourceName,
      dateLabel: '16 พ.ค. 2569',
      timeLabel: selectedTime,
      customerName,
      customerPhone: phone,
      amount: selected.price,
      paymentMethod: showMethodPicker ? paymentMethod : undefined,
      paymentStatus: showMethodPicker ? 'pending_payment' : 'unpaid',
    });
  }

  return (
    <Box sx={{ borderRadius: 1, bgcolor: '#f6f7f9', border: '1px solid #e4e8ee', p: 1.5 }}>
      <Typography sx={{ fontSize: 38, fontWeight: 800, color: '#152131', lineHeight: 1.05 }}>จองคิวผ่าน LINE</Typography>
      <Typography sx={{ color: '#7f8b98', mb: 1.4 }}>coffee</Typography>

      <Box sx={{ borderRadius: 999, border: '1px solid #b8e0c7', bgcolor: '#def3e8', px: 1.5, py: 0.8, mb: 1.4, color: '#2f7f4f' }}>
        เมนูนี้สำหรับจองคิว
      </Box>

      <Stack direction="row" spacing={1.2} sx={{ mb: 1.5 }}>
        <Button fullWidth variant="contained" onClick={() => setStep(1)} sx={{ borderRadius: 1, py: 1, bgcolor: step === 1 ? '#12a862' : '#fff', color: step === 1 ? '#fff' : '#2c3947', border: '1px solid #d6dce4', boxShadow: 'none' }}>
          1) ข้อมูลสมาชิก
        </Button>
        <Button fullWidth variant="contained" onClick={() => setStep(2)} sx={{ borderRadius: 1, py: 1, bgcolor: step === 2 ? '#12a862' : '#fff', color: step === 2 ? '#fff' : '#2c3947', border: '1px solid #d6dce4', boxShadow: 'none' }}>
          2) เลือกคิว
        </Button>
      </Stack>

      {step === 1 ? (
        <Stack spacing={1.2}>
          <TextField size="small" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
          <TextField size="small" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <Button fullWidth variant="contained" sx={{ bgcolor: '#12a862', borderRadius: 1, py: 1.1, boxShadow: 'none' }} onClick={() => setStep(2)}>
            ถัดไป: เลือกคิว
          </Button>
        </Stack>
      ) : (
        <Stack spacing={1.2}>
          {SERVICES.map((s) => {
            const active = s.id === serviceId;
            return (
              <Box
                key={s.id}
                onClick={() => setServiceId(s.id)}
                sx={{
                  borderRadius: 1,
                  px: 1.4,
                  py: 1.2,
                  border: '1px solid',
                  borderColor: active ? '#80ca9a' : '#d8dfe7',
                  bgcolor: active ? '#e9f7ee' : '#fff',
                  cursor: 'pointer',
                }}
              >
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography sx={{ fontSize: 26 }}>{s.icon}</Typography>
                  <Box sx={{ flex: 1 }}>
                    <Typography sx={{ fontWeight: 800 }}>{s.name}</Typography>
                    <Typography sx={{ fontSize: 12, color: '#637182' }}>{s.duration} • {s.mode}</Typography>
                  </Box>
                  {s.price > 0 ? (
                    <Typography sx={{ fontWeight: 800, fontSize: 13, color: '#0a7043', whiteSpace: 'nowrap' }}>
                      {formatTHB(s.price)} ฿
                    </Typography>
                  ) : null}
                </Stack>
              </Box>
            );
          })}

          <TextField size="small" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <Button fullWidth variant="contained" sx={{ bgcolor: '#12a862', borderRadius: 3, py: 1.05, boxShadow: 'none' }}>
            ดูเวลาว่าง
          </Button>

          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 1 }}>
            {TIMES.map((t) => {
              const active = t === selectedTime;
              return (
                <Button
                  key={t}
                  onClick={() => setSelectedTime(t)}
                  variant="contained"
                  sx={{
                    minHeight: 44,
                    borderRadius: 1.5,
                    bgcolor: active ? '#12a862' : '#fff',
                    color: active ? '#fff' : '#283647',
                    border: '1px solid #d7dee7',
                    boxShadow: 'none',
                    '&:hover': { bgcolor: active ? '#5ead77' : '#f5f8fb' },
                  }}
                >
                  {t}
                </Button>
              );
            })}
          </Box>

          {showMethodPicker ? (
            <Stack spacing={0.8} sx={{ borderRadius: 1, border: '1px solid #d8dfe7', bgcolor: '#fff', p: 1.2 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="baseline">
                <Typography sx={{ fontSize: 13, color: '#637182' }}>ยอดที่ต้องชำระ</Typography>
                <Typography sx={{ fontWeight: 900, fontSize: 20, color: '#0a7043' }}>{formatTHB(selected.price)} บาท</Typography>
              </Stack>
              <Typography sx={{ fontSize: 12, color: '#637182' }}>เลือกวิธีชำระเงิน</Typography>
              {DEMO_PAYMENT_METHODS.map((method) => {
                const active = method === paymentMethod;
                return (
                  <Box
                    key={method}
                    onClick={() => setPaymentMethod(method)}
                    sx={{
                      borderRadius: 1,
                      px: 1.2,
                      py: 0.9,
                      cursor: 'pointer',
                      border: '1px solid',
                      borderColor: active ? '#80ca9a' : '#d8dfe7',
                      bgcolor: active ? '#e9f7ee' : '#fff',
                    }}
                  >
                    <Typography sx={{ fontWeight: 800, fontSize: 14 }}>{DEMO_METHOD_LABELS[method].title}</Typography>
                    <Typography sx={{ fontSize: 12, color: '#637182' }}>{DEMO_METHOD_LABELS[method].hint}</Typography>
                  </Box>
                );
              })}
            </Stack>
          ) : null}

          <Button fullWidth variant="contained" sx={{ bgcolor: '#12a862', borderRadius: 1, py: 1.1, boxShadow: 'none', '&:hover': { bgcolor: '#5ead77' } }} onClick={handleConfirm}>
            ยืนยันการจอง
          </Button>
        </Stack>
      )}
    </Box>
  );
}
 
