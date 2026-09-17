'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Box, Button, Card, CardContent, Chip, Grid, Stack, Typography } from '@mui/material';
import { useI18n } from '@/components/i18n/i18n-provider';
import { useToast } from '@/components/ui/toast';
import { DemoControlPanel } from '@/components/demo/presentation/DemoControlPanel';
import { StepContentRenderer, type DemoStep } from '@/components/demo/presentation/StepContentRenderer';
import type { ChatMessage, DemoBooking, DemoMemberProfile, DemoMenuAction, DemoQueueItem } from '@/components/demo/line-demo-types';

let seq = 0;
function id() {
  seq += 1;
  return `presentation-${seq}`;
}

const initialMessages: ChatMessage[] = [
  { id: id(), role: 'customer', text: 'จองคิว' },
  { id: id(), role: 'bot', text: 'ต้องการจองบริการอะไรคะ?' },
];

const initialQueue: DemoQueueItem[] = [
  { id: id(), queueNo: 'A001', branchName: 'ประชาอุทิศ', serviceName: 'ตัดผมชาย', dateLabel: '16 พ.ค. 2569', timeLabel: '10:30', customerName: 'คุณเอ', resourceName: 'ช่างบอส', status: 'waiting', customerPhone: '0890000001' },
  { id: id(), queueNo: 'A002', branchName: 'ประชาอุทิศ', serviceName: 'จองรอบบุฟเฟ่ต์', dateLabel: '16 พ.ค. 2569', timeLabel: '11:00', customerName: 'คุณบี', resourceName: 'โต๊ะ T02', status: 'waiting', customerPhone: '0890000002' },
];

const stepKeys = [
  'demo_presentation.step_overview',
  'demo_presentation.step_line_chat',
  'demo_presentation.step_liff_booking',
  'demo_presentation.step_booking_success',
  'demo_presentation.step_queue_board',
  'demo_presentation.step_signage',
] as const;

export function PremiumDemoPresentation() {
  const { t } = useI18n();
  const { push } = useToast();
  const [currentStep, setCurrentStep] = useState<DemoStep>(1);
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [typing, setTyping] = useState(false);
  const [activeMenu, setActiveMenu] = useState<DemoMenuAction>('booking');
  const [booking, setBooking] = useState<DemoBooking | null>(null);
  const [queueItems, setQueueItems] = useState<DemoQueueItem[]>(initialQueue);
  const [signageDark, setSignageDark] = useState(true);
  const autoTimerRef = useRef<number | null>(null);
  const [memberProfile] = useState<DemoMemberProfile>({
    name: 'ลูกค้าประจำ',
    phone: '085-608-3298',
    tier: 'Silver',
    points: 120,
    totalBookings: 6,
    lastQueueNo: 'A001',
  });
  const stepTitleRef = useRef<HTMLDivElement | null>(null);

  const stepTitle = useMemo(() => t(stepKeys[currentStep - 1]), [currentStep, t]);

  const stepDescription = useMemo(() => {
    const map: Record<DemoStep, string> = {
      1: 'ภาพรวมการสาธิตระบบจองคิวผ่าน LINE OA แบบครบ flow',
      2: 'จำลองการสนทนาใน LINE และ Rich Menu แบบมือถือจริง',
      3: 'จำลองหน้าจองคิวใน LIFF พร้อมเลือกบริการและเวลา',
      4: 'แสดงการ์ดยืนยันจองคิวสำเร็จแบบ Flex Message',
      5: 'มุมมองทีมงานหน้าร้านบน Queue Board',
      6: 'มุมมองจอ Digital Signage สำหรับลูกค้าหน้าร้าน',
    };
    return map[currentStep];
  }, [currentStep]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    stepTitleRef.current?.focus();
  }, [currentStep]);

  useEffect(() => {
    if (autoTimerRef.current) {
      window.clearTimeout(autoTimerRef.current);
      autoTimerRef.current = null;
    }
    if (!isAutoPlaying) return;
    autoTimerRef.current = window.setTimeout(() => {
      if (currentStep === 1) {
        setCurrentStep(2);
        return;
      }
      if (currentStep === 2) {
        setMessages((prev) => [...prev, { id: id(), role: 'customer', text: 'จองคิว' }]);
        setTyping(true);
        window.setTimeout(() => {
          setTyping(false);
          setMessages((prev) => [...prev, { id: id(), role: 'bot', text: 'ต้องการให้เปิดหน้าจองคิวเลยไหมคะ' }]);
          setCurrentStep(3);
        }, 500);
        return;
      }
      if (currentStep === 3) {
        const demoBooking: DemoBooking = {
          queueNo: 'A001',
          branchName: 'ประชาอุทิศ',
          serviceName: 'ตัดผมชาย',
          resourceName: 'ช่างบอส',
          dateLabel: '16 พ.ค. 2569',
          timeLabel: '10:30',
          customerName: 'ลูกค้าตัวอย่าง',
          customerPhone: '0890000000',
        };
        onBooked(demoBooking);
        return;
      }
      if (currentStep === 4) {
        setCurrentStep(5);
        return;
      }
      if (currentStep === 5) {
        onQueueCall();
        setCurrentStep(6);
        return;
      }
      setIsAutoPlaying(false);
    }, 1900);
    return () => {
      if (autoTimerRef.current) {
        window.clearTimeout(autoTimerRef.current);
        autoTimerRef.current = null;
      }
    };
  }, [isAutoPlaying, currentStep]);

  function resetDemo() {
    setCurrentStep(1);
    setIsAutoPlaying(false);
    setMessages(initialMessages);
    setTyping(false);
    setActiveMenu('booking');
    setBooking(null);
    setQueueItems(initialQueue);
    setSignageDark(true);
  }

  function nextStep() {
    setCurrentStep((prev) => Math.min(6, prev + 1) as DemoStep);
  }

  function prevStep() {
    setCurrentStep((prev) => Math.max(1, prev - 1) as DemoStep);
  }

  function onQuickReply(key: 'today' | 'tomorrow' | 'morning' | 'afternoon' | 'contact') {
    const labelMap = { today: 'วันนี้มีคิวว่างไหม', tomorrow: 'พรุ่งนี้มีคิวไหม', morning: 'ขอคิวช่วงเช้า', afternoon: 'ขอคิวช่วงบ่าย', contact: 'ติดต่อร้าน' } as const;
    setMessages((prev) => [...prev, { id: id(), role: 'customer', text: labelMap[key] }]);
    setTyping(true);
    window.setTimeout(() => {
      setTyping(false);
      setMessages((prev) => [...prev, { id: id(), role: 'bot', text: 'รับทราบค่ะ ต้องการให้เปิดหน้าจองคิวเลยไหมคะ' }]);
    }, 550);
  }

  function onMenuSelect(key: DemoMenuAction) {
    setActiveMenu(key);
    if (key === 'booking' || key === 'open_liff') setCurrentStep(3);
  }

  function onBooked(nextBooking: DemoBooking) {
    setBooking(nextBooking);
    setMessages((prev) => [...prev, { id: id(), role: 'bot', type: 'flex_booking_success', booking: nextBooking }]);
    setCurrentStep(4);
  }

  function onQueueCall() {
    const target = queueItems.find((q) => q.status === 'waiting');
    if (!target) return;
    setQueueItems((prev) => prev.map((q) => (q.id === target.id ? { ...q, status: 'called' } : q)));
    setMessages((prev) => [...prev, { id: id(), role: 'bot', text: `ถึงคิวของคุณแล้วค่ะ\nเลขคิว ${target.queueNo}` }]);
  }

  function onQueueRecall() {
    const target = queueItems.find((q) => q.status === 'called');
    if (!target) return push('ยังไม่มีคิวที่ถูกเรียก', 'error');
    setMessages((prev) => [...prev, { id: id(), role: 'bot', text: `เรียกซ้ำอีกครั้ง\nเลขคิว ${target.queueNo}` }]);
  }

  function onQueueComplete() {
    const serving = queueItems.find((q) => q.status === 'serving') ?? queueItems.find((q) => q.status === 'called');
    if (!serving) return push('ยังไม่มีคิวที่จบได้', 'error');
    setQueueItems((prev) => prev.map((q) => {
      if (q.id === serving.id) return { ...q, status: 'completed' };
      if (q.status === 'called') return { ...q, status: 'serving' };
      return q;
    }));
    setMessages((prev) => [...prev, { id: id(), role: 'bot', text: `คิว ${serving.queueNo} เสร็จสิ้นแล้ว` }]);
  }

  function onQueueNear() {
    const target = queueItems.find((q) => q.status === 'waiting');
    if (!target) return push('ไม่มีคิว waiting สำหรับส่งแจ้งเตือน', 'error');
    setMessages((prev) => [...prev, { id: id(), role: 'bot', text: `ใกล้ถึงคิวของคุณแล้วค่ะ\nเลขคิว ${target.queueNo}` }]);
  }

  function handleStepAction(action: string) {
    if (action === 'chat_send_booking') {
      setMessages((prev) => [...prev, { id: id(), role: 'customer', text: 'จองคิว' }]);
      return;
    }
    if (action === 'chat_show_richmenu') {
      setActiveMenu('booking');
      return;
    }
    if (action === 'chat_reset') {
      setMessages(initialMessages);
      return;
    }
    if (action === 'liff_pick_service') return setCurrentStep(3);
    if (action === 'liff_pick_time') return setCurrentStep(3);
    if (action === 'liff_confirm') {
      const demoBooking: DemoBooking = {
        queueNo: 'A001',
        branchName: 'ประชาอุทิศ',
        serviceName: 'ตัดผมชาย',
        resourceName: 'ช่างบอส',
        dateLabel: '16 พ.ค. 2569',
        timeLabel: '10:30',
        customerName: 'ลูกค้าตัวอย่าง',
        customerPhone: '0890000000',
      };
      return onBooked(demoBooking);
    }
    if (action === 'queue_call') return onQueueCall();
    if (action === 'queue_recall') return onQueueRecall();
    if (action === 'queue_complete') return onQueueComplete();
    if (action === 'queue_near') return onQueueNear();
    if (action === 'signage_theme') return setSignageDark((x) => !x);
    if (action === 'signage_refresh') return push('รีเฟรชจอ Signage แล้ว');
    if (action === 'signage_fullscreen') return push('โหมด Fullscreen จำลองพร้อมใช้งาน');
  }

  return (
    <Stack spacing={2.5}>
      <Card sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider', boxShadow: 'none', background: 'linear-gradient(135deg,#ffffff 0%,#f6f8fa 100%)' }}>
        <CardContent>
          <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2} justifyContent="space-between">
            <Box ref={stepTitleRef} tabIndex={-1}>
              <Typography sx={{ fontSize: { xs: 30, md: 38 }, fontWeight: 900, color: '#111827' }}>{t('demo_presentation.title')}</Typography>
              <Typography sx={{ color: '#6B7280', maxWidth: 780 }}>{t('demo_presentation.subtitle')}</Typography>
              <Stack direction="row" spacing={1} sx={{ mt: 1.2, flexWrap: 'wrap' }}>
                <Button aria-label={t('demo_presentation.start_demo')} onClick={() => setCurrentStep(1)} variant="contained" sx={{ bgcolor: '#12a862', '&:hover': { bgcolor: '#5ead77' } }}>{t('demo_presentation.start_demo')}</Button>
                <Button aria-label={t('demo_presentation.connect_line')} component={Link} href="/portal/line-settings" variant="outlined">{t('demo_presentation.connect_line')}</Button>
                <Button aria-label={t('demo_presentation.open_setup_guide')} component={Link} href="/portal/onboarding/line-setup" variant="text">{t('demo_presentation.open_setup_guide')}</Button>
              </Stack>
            </Box>
            <Chip label={`STEP ${currentStep} / 6`} sx={{ alignSelf: 'flex-start', bgcolor: '#EAF3DE', color: '#0a7043', fontWeight: 800 }} />
          </Stack>
        </CardContent>
      </Card>

      <Grid container spacing={2.2}>
        <Grid size={{ xs: 12, lg: 2.6 }}>
          <Card sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider', boxShadow: 'none' }}>
            <CardContent>
              <Stack spacing={1}>
                {stepKeys.map((k, idx) => {
                  const step = (idx + 1) as DemoStep;
                  const active = step === currentStep;
                  return (
                    <Button
                      key={k}
                      aria-label={`Go to step ${step}`}
                      variant={active ? 'contained' : 'outlined'}
                      onClick={() => setCurrentStep(step)}
                      sx={{ justifyContent: 'flex-start', textTransform: 'none', bgcolor: active ? '#12a862' : undefined, '&:hover': { bgcolor: active ? '#5ead77' : undefined } }}
                    >
                      {step}. {t(k)}
                    </Button>
                  );
                })}
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, lg: 6.8 }}>
          <StepContentRenderer
            currentStep={currentStep}
            title={stepTitle}
            description={stepDescription}
            messages={messages}
            typing={typing}
            memberProfile={memberProfile}
            activeMenu={activeMenu}
            queueItems={queueItems}
            booking={booking}
            onQuickReply={onQuickReply}
            onMenuSelect={onMenuSelect}
            onBooked={onBooked}
            onQueueCall={onQueueCall}
            signageDark={signageDark}
          />
        </Grid>

        <Grid size={{ xs: 12, lg: 2.6 }}>
          <DemoControlPanel
            currentStep={currentStep}
            canPrev={currentStep > 1}
            canNext={currentStep < 6}
            isAutoPlaying={isAutoPlaying}
            onPrev={prevStep}
            onNext={nextStep}
            onStart={() => setCurrentStep(1)}
            onAutoPlayToggle={() => setIsAutoPlaying((x) => !x)}
            onReset={resetDemo}
            onStepAction={handleStepAction}
            labels={{
              title: t('demo_presentation.control_title'),
              subtitle: t('demo_presentation.control_subtitle'),
              start: t('demo_presentation.start_demo'),
              previous: t('demo_presentation.previous'),
              next: t('demo_presentation.next'),
              autoPlay: t('demo_presentation.auto_play'),
              stopAutoPlay: t('demo_presentation.stop_auto_play'),
              reset: t('demo_presentation.reset_demo'),
              stepActions: t('demo_presentation.step_actions'),
              currentStep: t('demo_presentation.current_step'),
            }}
          />
        </Grid>
      </Grid>
    </Stack>
  );
}
