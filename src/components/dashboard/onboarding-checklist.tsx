'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Box, Button, Card, CardContent, Chip, LinearProgress, Stack, Typography } from '@mui/material';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import RadioButtonUncheckedRoundedIcon from '@mui/icons-material/RadioButtonUncheckedRounded';

type Step = { key: string; done: boolean };

type Status = {
  steps: Step[];
  completed: number;
  total: number;
  shop_key: string | null;
};

const STEP_COPY: Record<string, { title: string; hint: string; href: string; cta: string }> = {
  branch: {
    title: 'สร้างสาขา',
    hint: 'อย่างน้อย 1 สาขาเพื่อให้ลูกค้าเลือกจองได้',
    href: '/portal/branches',
    cta: 'ไปที่สาขา',
  },
  service: {
    title: 'เพิ่มบริการ',
    hint: 'บอกลูกค้าว่าจองอะไรได้บ้าง และใช้เวลาเท่าไร',
    href: '/portal/services',
    cta: 'ไปที่บริการ',
  },
  working_hours: {
    title: 'ตั้งเวลาทำการ',
    hint: 'ถ้าไม่มีเวลาทำการ ระบบจะแสดงว่าร้านปิดทุกวัน และลูกค้าจองไม่ได้',
    href: '/portal/working-hours',
    cta: 'ตั้งเวลาทำการ',
  },
  line: {
    title: 'เชื่อมต่อ LINE OA',
    hint: 'ใส่ Channel Token, Secret และ LIFF ID เพื่อให้ลูกค้าจองผ่าน LINE',
    href: '/portal/onboarding/line-setup',
    cta: 'เชื่อมต่อ LINE',
  },
  first_booking: {
    title: 'รับคิวแรก',
    hint: 'ลองสร้างคิวเองหรือส่งลิงก์จองให้ลูกค้าทดลอง',
    href: '/portal/bookings',
    cta: 'ไปที่คิว',
  },
};

/**
 * Activation checklist shown until a shop is fully set up. A new shop lands on
 * a dashboard of zeros with no indication of what to do next; this replaces
 * that with the specific next action and where to take it.
 */
export function OnboardingChecklist() {
  const [status, setStatus] = useState<Status | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setDismissed(window.localStorage.getItem('qb-onboarding-dismissed') === '1');

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/onboarding-status', { cache: 'no-store' });
        const body = (await res.json()) as { data: Status | null };
        if (!cancelled && res.ok) setStatus(body.data);
      } catch {
        // Checklist is a hint, not a blocker — stay silent on failure.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!status || dismissed) return null;

  const complete = status.completed >= status.total;
  if (complete) return null;

  const nextStep = status.steps.find((s) => !s.done);
  const progress = Math.round((status.completed / status.total) * 100);

  function dismiss() {
    window.localStorage.setItem('qb-onboarding-dismissed', '1');
    setDismissed(true);
  }

  return (
    <Card variant="outlined" sx={{ borderRadius: 3 }}>
      <CardContent>
        <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1}>
          <Box>
            <Typography variant="h6" fontWeight={700}>
              ตั้งค่าให้ร้านพร้อมรับคิว
            </Typography>
            <Typography variant="body2" color="text.secondary">
              เสร็จแล้ว {status.completed} จาก {status.total} ขั้นตอน
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} alignItems="center">
            {nextStep && (
              <Button component={Link} href={STEP_COPY[nextStep.key]?.href ?? '/portal'} variant="contained" size="small">
                {STEP_COPY[nextStep.key]?.cta ?? 'ทำต่อ'}
              </Button>
            )}
            <Button size="small" color="inherit" onClick={dismiss}>
              ซ่อน
            </Button>
          </Stack>
        </Stack>

        <LinearProgress variant="determinate" value={progress} sx={{ mt: 2, height: 6, borderRadius: 3 }} />

        <Stack spacing={1.25} sx={{ mt: 2 }}>
          {status.steps.map((step) => {
            const copy = STEP_COPY[step.key];
            if (!copy) return null;
            return (
              <Stack key={step.key} direction="row" spacing={1.25} alignItems="flex-start">
                {step.done ? (
                  <CheckCircleRoundedIcon color="success" sx={{ fontSize: 20, mt: '2px' }} />
                ) : (
                  <RadioButtonUncheckedRoundedIcon sx={{ fontSize: 20, mt: '2px', color: 'text.disabled' }} />
                )}
                <Box sx={{ flex: 1 }}>
                  <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                    <Typography variant="body2" fontWeight={600} sx={{ opacity: step.done ? 0.6 : 1 }}>
                      {copy.title}
                    </Typography>
                    {!step.done && step.key === 'working_hours' && (
                      <Chip label="จำเป็นต่อการจอง" size="small" color="warning" variant="outlined" />
                    )}
                  </Stack>
                  {!step.done && (
                    <Typography variant="caption" color="text.secondary">
                      {copy.hint}{' '}
                      <Box component={Link} href={copy.href} sx={{ color: 'primary.main', fontWeight: 600 }}>
                        {copy.cta}
                      </Box>
                    </Typography>
                  )}
                </Box>
              </Stack>
            );
          })}
        </Stack>
      </CardContent>
    </Card>
  );
}
