'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Button, Card, CardContent, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Grid, MenuItem, Stack, TextField, Typography } from '@mui/material';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import CampaignRoundedIcon from '@mui/icons-material/CampaignRounded';
import PhoneInTalkRoundedIcon from '@mui/icons-material/PhoneInTalkRounded';
import NotificationsActiveRoundedIcon from '@mui/icons-material/NotificationsActiveRounded';
import ReplayRoundedIcon from '@mui/icons-material/ReplayRounded';
import QueueRoundedIcon from '@mui/icons-material/QueueRounded';
import AddCircleOutlineRoundedIcon from '@mui/icons-material/AddCircleOutlineRounded';
import AutorenewRoundedIcon from '@mui/icons-material/AutorenewRounded';
import FullscreenRoundedIcon from '@mui/icons-material/FullscreenRounded';
import { LineChatSimulator } from '@/components/demo/line-chat-simulator';
import { LiffBookingSimulator } from '@/components/demo/liff-booking-simulator';
import { DemoPaymentSimulator } from '@/components/demo/demo-payment-simulator';
import { RichMenuSimulator } from '@/components/demo/rich-menu-simulator';
import { DemoQueueBoard } from '@/components/demo/demo-queue-board';
import { DemoSignage } from '@/components/demo/demo-signage';
import type { PromoCard } from '@/components/demo/demo-flex-carousel';
import type { ChatMessage, DemoBooking, DemoMemberProfile, DemoMenuAction, DemoQueueItem, DemoQueueStatus, DemoTemplate } from '@/components/demo/line-demo-types';
import type { PaymentMethod } from '@/types/db';

let demoIdSeq = 0;
function id() {
  demoIdSeq += 1;
  return `demo-${demoIdSeq}`;
}

const TEMPLATE_CONFIG: Record<DemoTemplate, {
  shopName: string;
  menuLabels: Partial<Record<DemoMenuAction, string>>;
  promos: PromoCard[];
  resourceLabel: string;
}> = {
  barber: {
    shopName: 'queue booking',
    menuLabels: { booking: 'จองคิว', check: 'ดูคิว', promo: 'โปรโมชัน' },
    promos: [
      { id: 'b1', title: 'ตัดผม + สระ ลด 15%', subtitle: 'เฉพาะวันจันทร์ - พฤหัส', cta: 'จองเลย' },
      { id: 'b2', title: 'สมาชิกใหม่ลดเพิ่ม', subtitle: 'สมัครสมาชิกผ่าน LINE รับส่วนลดทันที', cta: 'ดูรายละเอียด' },
    ],
    resourceLabel: 'ช่างบอส',
  },
  restaurant: {
    shopName: 'ร้านอาหาร / บุฟเฟ่ต์',
    menuLabels: { booking: 'จองโต๊ะ', check: 'คิวโต๊ะ', promo: 'ดีลพิเศษ' },
    promos: [
      { id: 'r1', title: 'โปร 4 จ่าย 3', subtitle: 'บุฟเฟ่ต์รอบเย็นทุกวันอังคาร', cta: 'จองรอบ 19:00' },
      { id: 'r2', title: 'ส่วนลดวันเกิด', subtitle: 'แสดงบัตรประชาชนรับเค้กฟรี', cta: 'รับสิทธิ์' },
    ],
    resourceLabel: 'โต๊ะ T02',
  },
  clinic: {
    shopName: 'คลินิก / ความงาม',
    menuLabels: { booking: 'นัดหมาย', check: 'คิวตรวจ', promo: 'แพ็กเกจ' },
    promos: [
      { id: 'c1', title: 'ฟรี! ประเมินผิว', subtitle: 'เมื่อจองคอร์สดูแลผิวครบ 3 ครั้ง', cta: 'นัดตรวจ' },
      { id: 'c2', title: 'แพ็กเกจ Botox', subtitle: 'จองคิวผ่าน LINE รับส่วนลด 10%', cta: 'ดูแพ็กเกจ' },
    ],
    resourceLabel: 'ห้อง 1',
  },
  meeting: {
    shopName: 'ห้องประชุม',
    menuLabels: { booking: 'จองห้อง', check: 'สถานะห้อง', promo: 'แพ็กเกจห้อง' },
    promos: [
      { id: 'm1', title: 'Half-Day Package', subtitle: 'จองครึ่งวัน ฟรีโปรเจกเตอร์', cta: 'จองช่วงเช้า' },
      { id: 'm2', title: 'Corporate Plan', subtitle: 'เหมารายเดือนลดสูงสุด 20%', cta: 'ติดต่อเซลล์' },
    ],
    resourceLabel: 'ROOM-A',
  },
};

const initialMessages: ChatMessage[] = [
  { id: id(), role: 'customer', text: 'จองคิว' },
  { id: id(), role: 'bot', text: 'ต้องการบริการอะไรคะ' },
  { id: id(), role: 'bot', text: 'เลือกจาก Rich Menu ด้านล่างได้เลยค่ะ' },
];

const seededQueue: DemoQueueItem[] = [
  { id: id(), queueNo: 'A001', branchName: 'ประชาอุทิศ', serviceName: 'ตัดผมชาย', dateLabel: '16 พ.ค. 2569', timeLabel: '09:30', customerName: 'คุณเอ', resourceName: 'ช่างบอส', status: 'waiting', customerPhone: '0890000001', amount: 300, paymentMethod: 'omise_promptpay', paymentStatus: 'paid' },
  { id: id(), queueNo: 'A002', branchName: 'ประชาอุทิศ', serviceName: 'ตัดผม + สระ', dateLabel: '16 พ.ค. 2569', timeLabel: '10:00', customerName: 'คุณบี', resourceName: 'ช่างโต', status: 'called', customerPhone: '0890000002', amount: 450, paymentMethod: 'bank_transfer', paymentStatus: 'awaiting_verification' },
  { id: id(), queueNo: 'A003', branchName: 'ประชาอุทิศ', serviceName: 'ทำสีผม', dateLabel: '16 พ.ค. 2569', timeLabel: '10:30', customerName: 'คุณซี', resourceName: 'ช่างบั้ม', status: 'serving', customerPhone: '0890000003', amount: 1200, paymentMethod: 'bank_transfer', paymentStatus: 'pending_payment' },
  { id: id(), queueNo: 'A004', branchName: 'ประชาอุทิศ', serviceName: 'สระผม', dateLabel: '16 พ.ค. 2569', timeLabel: '11:00', customerName: 'คุณดี', resourceName: 'ช่างบอส', status: 'completed', customerPhone: '0890000004', amount: 150, paymentMethod: 'omise_promptpay', paymentStatus: 'paid' },
];

/** Ordered demo steps; index drives the chip label, progress bar and Next Step button. */
type DemoStepKey = 'chat' | 'booking' | 'payment' | 'notify' | 'board' | 'signage';
const STEP_ORDER: DemoStepKey[] = ['chat', 'booking', 'payment', 'notify', 'board', 'signage'];

/** Which earlier steps a jump must unlock, so a walktour jump never lands on a locked panel. */
function unlockedUpTo(step: DemoStepKey, prev: Record<DemoStepKey, boolean>): Record<DemoStepKey, boolean> {
  const limit = STEP_ORDER.indexOf(step);
  const next = { ...prev };
  STEP_ORDER.forEach((key, index) => {
    if (index <= limit) next[key] = true;
  });
  return next;
}

type SyncEvent =
  | { type: 'reset' }
  | { type: 'menu'; key: DemoMenuAction }
  | { type: 'quick'; key: 'today' | 'tomorrow' | 'morning' | 'afternoon' | 'contact' }
  | { type: 'booked'; booking: DemoBooking }
  | { type: 'payment'; action: 'method' | 'slip' | 'paid' | 'reject'; method?: PaymentMethod; reason?: string }
  | { type: 'queue'; action: 'call_next' | 'recall' | 'near' | 'advance' | 'add' }
  | { type: 'template'; template: DemoTemplate };

export function DemoLineExperiencePanel() {
  const sourceId = useRef(id());
  const channelRef = useRef<BroadcastChannel | null>(null);
  const motionRootRef = useRef<HTMLDivElement | null>(null);
  const step5FullscreenRef = useRef<HTMLDivElement | null>(null);
  const step6FullscreenRef = useRef<HTMLDivElement | null>(null);

  const [template, setTemplate] = useState<DemoTemplate>('barber');
  const [activeMenu, setActiveMenu] = useState<DemoMenuAction>('booking');
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [typing, setTyping] = useState(false);
  const [showLiff, setShowLiff] = useState(true);
  const [lastBooking, setLastBooking] = useState<DemoBooking | null>(null);
  const [queueItems, setQueueItems] = useState<DemoQueueItem[]>(seededQueue);
  const [currentStep, setCurrentStep] = useState<DemoStepKey>('chat');
  const [unlockedSteps, setUnlockedSteps] = useState<Record<DemoStepKey, boolean>>({
    chat: true,
    booking: false,
    payment: false,
    notify: false,
    board: false,
    signage: false,
  });
  const [memberProfile, setMemberProfile] = useState<DemoMemberProfile>({
    name: 'ลูกค้าประจำ',
    phone: '085-608-3298',
    tier: 'Silver',
    points: 120,
    totalBookings: 6,
    lastQueueNo: 'A003',
  });
  const [walktourOpen, setWalktourOpen] = useState(false);
  const [walktourIndex, setWalktourIndex] = useState(0);

  const templateConfig = useMemo(() => TEMPLATE_CONFIG[template], [template]);
  const currentStepIndex = STEP_ORDER.indexOf(currentStep);
  const nextStep = currentStepIndex >= 0 ? STEP_ORDER[currentStepIndex + 1] : undefined;
  const walktourSteps: Array<{ step: DemoStepKey; title: string; description: string }> = [
    { step: 'chat', title: 'STEP 1: LINE Chat', description: 'เริ่มจากแชทลูกค้าใน LINE และกดเมนูจองคิวจาก Rich Menu' },
    { step: 'booking', title: 'STEP 2: LIFF Booking', description: 'เลือกบริการ วัน เวลา และยืนยันการจองผ่าน LIFF' },
    { step: 'payment', title: 'STEP 3: ชำระเงิน', description: 'ทดลองรับชำระเงิน 2 แบบ — สแกน QR PromptPay ที่ยืนยันอัตโนมัติ และโอนเงินแล้วส่งสลิปให้ร้านอนุมัติเอง' },
    { step: 'notify', title: 'STEP 4: Queue Notification', description: 'ฝั่งร้านทดลองส่งแจ้งเตือน เรียกคิว และอัปเดตสถานะคิว' },
    { step: 'board', title: 'STEP 5: Queue Board', description: 'ดูภาพรวมคิวสำหรับพนักงาน พร้อมมุมมองลูกค้าแบบมือถือ' },
    { step: 'signage', title: 'STEP 6: Signage View', description: 'แสดงจอเรียกคิวหน้าร้านสำหรับลูกค้าที่รอคิว' },
  ];
  const activeWalktourStep = walktourSteps[walktourIndex];

  function unlockStep(step: DemoStepKey) {
    setUnlockedSteps((prev) => (prev[step] ? prev : { ...prev, [step]: true }));
  }

  function goToNextStep() {
    if (!nextStep || !unlockedSteps[nextStep]) return;
    setCurrentStep(nextStep);
  }

  function goToStepWithUnlock(step: DemoStepKey) {
    setUnlockedSteps((prev) => unlockedUpTo(step, prev));
    setCurrentStep(step);
  }

  function startWalktour() {
    setWalktourIndex(0);
    setWalktourOpen(true);
    goToStepWithUnlock('chat');
  }

  function moveWalktour(direction: 'next' | 'prev') {
    if (!activeWalktourStep) return;
    if (direction === 'prev') {
      const prevIndex = Math.max(0, walktourIndex - 1);
      setWalktourIndex(prevIndex);
      goToStepWithUnlock(walktourSteps[prevIndex].step);
      return;
    }
    const isLast = walktourIndex >= walktourSteps.length - 1;
    if (isLast) {
      setWalktourOpen(false);
      return;
    }
    const nextIndex = walktourIndex + 1;
    setWalktourIndex(nextIndex);
    goToStepWithUnlock(walktourSteps[nextIndex].step);
  }

  async function openFullscreen(target: 'board' | 'signage') {
    const element = target === 'board' ? step5FullscreenRef.current : step6FullscreenRef.current;
    if (!element) return;
    await element.requestFullscreen?.();
  }

  useEffect(() => {
    let cancelled = false;
    let revertMotion = () => {};

    async function setupIntroMotion() {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

      const { gsap } = await import('gsap');
      if (cancelled || !motionRootRef.current) return;

      const context = gsap.context(() => {
        const timeline = gsap.timeline({ defaults: { ease: 'power3.out' } });

        timeline.fromTo(
          '[data-demo-intro]',
          { y: 28, autoAlpha: 0, filter: 'blur(10px)' },
          {
            y: 0,
            autoAlpha: 1,
            filter: 'blur(0px)',
            duration: 0.72,
            stagger: 0.12,
            clearProps: 'transform,opacity,visibility,filter',
          },
        );

        timeline.fromTo(
          '[data-demo-step-chip]',
          { y: 10, scale: 0.85, autoAlpha: 0 },
          {
            y: 0,
            scale: 1,
            autoAlpha: 1,
            duration: 0.4,
            stagger: 0.06,
            ease: 'back.out(2)',
            clearProps: 'transform,opacity,visibility',
          },
          '-=0.4',
        );
      }, motionRootRef);

      revertMotion = () => context.revert();
    }

    void setupIntroMotion();

    return () => {
      cancelled = true;
      revertMotion();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let revertMotion = () => {};

    async function setupStepMotion() {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

      const { gsap } = await import('gsap');
      const root = motionRootRef.current;
      if (cancelled || !root) return;

      const context = gsap.context(() => {
        const stage = root.querySelector<HTMLElement>('[data-demo-stage]');
        const panels = stage?.querySelectorAll<HTMLElement>('[data-demo-panel]') ?? [];
        const activeStep = root.querySelector<HTMLElement>('[data-demo-active-step="true"]');
        const timeline = gsap.timeline({ defaults: { ease: 'power3.out' } });

        if (stage) {
          timeline.fromTo(
            stage,
            { y: 24, autoAlpha: 0 },
            {
              y: 0,
              autoAlpha: 1,
              duration: 0.5,
              clearProps: 'transform,opacity,visibility',
            },
          );
        }

        if (panels.length > 0) {
          timeline.fromTo(
            panels,
            { y: 26, scale: 0.96, rotateX: -8, transformOrigin: '50% 0%', autoAlpha: 0 },
            {
              y: 0,
              scale: 1,
              rotateX: 0,
              autoAlpha: 1,
              duration: 0.62,
              stagger: 0.09,
              clearProps: 'transform,opacity,visibility',
            },
            stage ? '-=0.3' : 0,
          );
        }

        const queueCards = root.querySelectorAll<HTMLElement>('[data-queue-card]');
        if (queueCards.length > 0) {
          timeline.fromTo(
            queueCards,
            { y: 14, autoAlpha: 0 },
            {
              y: 0,
              autoAlpha: 1,
              duration: 0.4,
              stagger: 0.045,
              clearProps: 'transform,opacity,visibility',
            },
            '-=0.35',
          );
        }

        if (activeStep) {
          timeline.fromTo(
            activeStep,
            { scale: 0.9 },
            {
              scale: 1,
              duration: 0.38,
              ease: 'back.out(1.8)',
              clearProps: 'transform',
            },
            '-=0.32',
          );
        }

        const progressBar = root.querySelector<HTMLElement>('[data-demo-progress-fill]');
        if (progressBar) {
          const ratio = (STEP_ORDER.indexOf(currentStep) + 1) / STEP_ORDER.length;
          gsap.to(progressBar, { width: `${ratio * 100}%`, duration: 0.6, ease: 'power2.out' });
        }
      }, root);

      revertMotion = () => context.revert();
    }

    void setupStepMotion();

    return () => {
      cancelled = true;
      revertMotion();
    };
  }, [currentStep]);

  /** Signature of queue statuses; changes whenever a card moves between columns. */
  const queueSignature = queueItems.map((item) => `${item.id}:${item.status}`).join('|');

  // Re-pops the queue cards when a card changes column, so status moves read as motion
  // instead of an instant swap.
  useEffect(() => {
    let cancelled = false;
    let revertMotion = () => {};

    async function animateQueueShift() {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

      const { gsap } = await import('gsap');
      const root = motionRootRef.current;
      if (cancelled || !root) return;

      const context = gsap.context(() => {
        const cards = root.querySelectorAll<HTMLElement>('[data-queue-card]');
        if (cards.length === 0) return;
        gsap.fromTo(
          cards,
          { y: 8, scale: 0.97, autoAlpha: 0.35 },
          {
            y: 0,
            scale: 1,
            autoAlpha: 1,
            duration: 0.38,
            stagger: 0.035,
            ease: 'power2.out',
            clearProps: 'transform,opacity,visibility',
          },
        );
      }, root);

      revertMotion = () => context.revert();
    }

    void animateQueueShift();

    return () => {
      cancelled = true;
      revertMotion();
    };
  }, [queueSignature]);

  // Pulses the phone mockups whenever a new LINE message lands, so the eye is
  // pulled to the panel that actually changed.
  useEffect(() => {
    let cancelled = false;
    let revertMotion = () => {};

    async function pulsePhone() {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

      const { gsap } = await import('gsap');
      const root = motionRootRef.current;
      if (cancelled || !root) return;

      const context = gsap.context(() => {
        const phones = root.querySelectorAll<HTMLElement>('[data-demo-phone]');
        if (phones.length === 0) return;
        gsap.fromTo(
          phones,
          { boxShadow: '0 0 0 0 rgba(18,168,98,.45)' },
          {
            boxShadow: '0 0 0 12px rgba(18,168,98,0)',
            duration: 0.85,
            ease: 'power2.out',
            clearProps: 'boxShadow',
          },
        );
      }, root);

      revertMotion = () => context.revert();
    }

    void pulsePhone();

    return () => {
      cancelled = true;
      revertMotion();
    };
  }, [messages.length]);

  useEffect(() => {
    const channel = new BroadcastChannel('demo-line-experience-sync');
    channelRef.current = channel;
    channel.onmessage = (event: MessageEvent<{ source: string; payload: SyncEvent }>) => {
      if (!event.data || event.data.source === sourceId.current) return;
      handleEvent(event.data.payload, false);
    };
    return () => {
      channel.close();
      channelRef.current = null;
    };
  }, [queueItems, lastBooking, template]);

  function emit(payload: SyncEvent) {
    channelRef.current?.postMessage({ source: sourceId.current, payload });
  }

  function pushMessage(message: ChatMessage) {
    setMessages((prev) => [...prev, message]);
  }

  function botReply(text: string, delay = 500) {
    setTyping(true);
    window.setTimeout(() => {
      setTyping(false);
      pushMessage({ id: id(), role: 'bot', text });
    }, delay);
  }

  function queueNotify(item: DemoQueueItem, type: 'called' | 'near' | 'repeat') {
    const suffix = type === 'near' ? 'ใกล้ถึงคิวของคุณแล้วค่ะ' : 'ถึงคิวของคุณแล้วค่ะ';
    const line = item.resourceName ? `จุดบริการ ${item.resourceName}` : `สาขา ${item.branchName}`;
    const repeatText = type === 'repeat' ? 'เรียกซ้ำอีกครั้งค่ะ' : '';
    botReply(`${suffix}\nเลขคิว ${item.queueNo}\n${line}\nกรุณาไปที่จุดบริการภายใน 5 นาทีค่ะ ${repeatText}`.trim(), 250);
  }

  function updateStatus(targetId: string, next: DemoQueueStatus) {
    setQueueItems((prev) => prev.map((q) => (q.id === targetId ? { ...q, status: next } : q)));
  }

  function onCallNextQueue() {
    const target = queueItems.find((q) => q.status === 'waiting');
    if (!target) {
      botReply('ไม่มีคิว waiting สำหรับเรียกถัดไปค่ะ', 200);
      return;
    }
    updateStatus(target.id, 'called');
    queueNotify({ ...target, status: 'called' }, 'called');
  }

  function onRecallQueue() {
    const target = queueItems.find((q) => q.status === 'called');
    if (!target) {
      botReply('ยังไม่มีคิวที่อยู่สถานะ called ค่ะ', 200);
      return;
    }
    queueNotify(target, 'repeat');
  }

  function onNearQueue() {
    const target = queueItems.find((q) => q.status === 'waiting');
    if (!target) {
      botReply('ยังไม่มีคิว waiting สำหรับแจ้งเตือนล่วงหน้าค่ะ', 200);
      return;
    }
    queueNotify(target, 'near');
  }

  function onAdvanceStatus() {
    const targetCalled = queueItems.find((q) => q.status === 'called');
    if (targetCalled) {
      updateStatus(targetCalled.id, 'serving');
      botReply(`คิว ${targetCalled.queueNo} เปลี่ยนเป็นกำลังให้บริการแล้วค่ะ`, 220);
      return;
    }
    const targetServing = queueItems.find((q) => q.status === 'serving');
    if (targetServing) {
      updateStatus(targetServing.id, 'completed');
      botReply(`คิว ${targetServing.queueNo} ให้บริการเสร็จแล้วค่ะ`, 220);
      return;
    }
    botReply('ยังไม่มีคิวที่เปลี่ยนสถานะได้ในตอนนี้', 220);
  }

  function createDemoBookingFromAdmin() {
    const num = queueItems.length + 1;
    const booking: DemoQueueItem = {
      id: id(),
      queueNo: `A${String(num).padStart(3, '0')}`,
      branchName: 'ประชาอุทิศ',
      serviceName: 'ตัดผมชาย',
      dateLabel: '16 พ.ค. 2569',
      timeLabel: '14:00',
      customerName: `ลูกค้าตัวอย่าง ${num}`,
      customerPhone: `0890000${String(num).padStart(3, '0')}`,
      resourceName: templateConfig.resourceLabel,
      status: 'waiting',
    };
    setQueueItems((prev) => [...prev, booking]);
    botReply(`เพิ่มคิวตัวอย่าง ${booking.queueNo} แล้ว`, 180);
  }

  function onMenuSelect(key: DemoMenuAction) {
    setActiveMenu(key);
    if (key === 'booking' || key === 'open_liff') {
      unlockStep('booking');
      setCurrentStep('booking');
      setShowLiff(true);
      botReply('กรุณาเลือกบริการ วัน และเวลาใน LIFF Simulator ได้เลยค่ะ');
      return;
    }
    if (key === 'member') {
      pushMessage({ id: id(), role: 'bot', type: 'member_profile' });
      return;
    }
    if (key === 'check') {
      if (lastBooking) {
        pushMessage({ id: id(), role: 'bot', type: 'flex_booking_success', booking: lastBooking });
      } else {
        botReply('ยังไม่พบคิวล่าสุดค่ะ ลองกดเมนูจองคิวก่อนนะคะ');
      }
      return;
    }
    if (key === 'promo') {
      pushMessage({ id: id(), role: 'bot', type: 'promo', promos: templateConfig.promos });
      return;
    }
    botReply('ทีมงานพร้อมช่วยเหลือค่ะ สามารถพิมพ์คำถามได้เลย');
  }

  function onQuickReply(key: 'today' | 'tomorrow' | 'morning' | 'afternoon' | 'contact') {
    const textMap = {
      today: 'วันนี้มีคิวว่างไหม',
      tomorrow: 'พรุ่งนี้มีคิวไหม',
      morning: 'ขอคิวช่วงเช้า',
      afternoon: 'ขอคิวช่วงบ่าย',
      contact: 'ติดต่อร้าน',
    } as const;
    pushMessage({ id: id(), role: 'customer', text: textMap[key] });
    if (key === 'contact') {
      botReply('รับทราบค่ะ เจ้าหน้าที่จะตอบกลับในไม่กี่นาที');
      return;
    }
    botReply('มีคิวว่างค่ะ ต้องการให้เปิดหน้าจองคิวเลยไหมคะ');
  }

  function onBooked(booking: DemoBooking) {
    const needsPayment = (booking.amount ?? 0) > 0;
    // The real flow books first and invoices afterwards, so the queue card
    // appears immediately — it just carries a "รอชำระ" badge until paid.
    if (needsPayment) {
      unlockStep('payment');
      setCurrentStep('payment');
    } else {
      unlockStep('notify');
      setCurrentStep('notify');
    }
    setLastBooking(booking);
    setShowLiff(false);
    setQueueItems((prev) => [...prev, { id: id(), ...booking, status: 'waiting', resourceName: templateConfig.resourceLabel }]);
    setMemberProfile((prev) => ({
      ...prev,
      name: booking.customerName,
      phone: booking.customerPhone || prev.phone,
      totalBookings: prev.totalBookings + 1,
      points: prev.points + 10,
      lastQueueNo: booking.queueNo,
    }));
    pushMessage({ id: id(), role: 'customer', text: `เลือกเวลา ${booking.timeLabel}` });
    setTyping(true);
    window.setTimeout(() => {
      setTyping(false);
      pushMessage({ id: id(), role: 'bot', text: 'จองคิวสำเร็จค่ะ' });
      pushMessage({ id: id(), role: 'bot', type: 'flex_booking_success', booking });
      if (needsPayment) pushMessage({ id: id(), role: 'bot', type: 'flex_payment_request', booking });
      setActiveMenu('check');
    }, 650);
  }

  /** Applies a payment change to both the last booking and its queue card. */
  function patchLastBooking(patch: Partial<DemoBooking>) {
    setLastBooking((prev) => (prev ? { ...prev, ...patch } : prev));
    setQueueItems((prev) => prev.map((q) => (lastBooking && q.queueNo === lastBooking.queueNo ? { ...q, ...patch } : q)));
  }

  function onPaymentEvent(action: 'method' | 'slip' | 'paid' | 'reject', method?: PaymentMethod, reason?: string) {
    if (!lastBooking) return;

    if (action === 'method') {
      if (!method) return;
      // Switching method re-issues the invoice, exactly as the real flow does.
      patchLastBooking({ paymentMethod: method, paymentStatus: 'pending_payment' });
      pushMessage({ id: id(), role: 'bot', type: 'flex_payment_request', booking: { ...lastBooking, paymentMethod: method, paymentStatus: 'pending_payment' } });
      return;
    }

    if (action === 'slip') {
      patchLastBooking({ paymentStatus: 'awaiting_verification' });
      pushMessage({ id: id(), role: 'customer', text: 'ส่งสลิปการโอนแล้วค่ะ' });
      botReply('ได้รับสลิปแล้วค่ะ กำลังรอร้านตรวจสอบ จะแจ้งผลให้ทราบทางนี้ค่ะ', 320);
      return;
    }

    if (action === 'reject') {
      patchLastBooking({ paymentStatus: 'rejected' });
      botReply(`สลิปไม่ผ่านการตรวจสอบค่ะ\nเหตุผล: ${reason ?? 'ยอดเงินไม่ตรง'}\nกรุณาอัปโหลดสลิปใหม่อีกครั้งค่ะ`, 320);
      return;
    }

    patchLastBooking({ paymentStatus: 'paid' });
    unlockStep('notify');
    setTyping(true);
    window.setTimeout(() => {
      setTyping(false);
      pushMessage({ id: id(), role: 'bot', type: 'flex_payment_paid', booking: { ...lastBooking, paymentStatus: 'paid' } });
      setCurrentStep('notify');
    }, 480);
  }

  function resetDemo() {
    setMessages(initialMessages);
    setLastBooking(null);
    setActiveMenu('booking');
    setShowLiff(true);
    setTyping(false);
    setQueueItems(seededQueue);
    setCurrentStep('chat');
    setUnlockedSteps({ chat: true, booking: false, payment: false, notify: false, board: false, signage: false });
    setMemberProfile({
      name: 'ลูกค้าประจำ',
      phone: '085-608-3298',
      tier: 'Silver',
      points: 120,
      totalBookings: 6,
      lastQueueNo: 'A003',
    });
  }

  function handleEvent(payload: SyncEvent, shouldEmit = true) {
    if (payload.type === 'reset') resetDemo();
    if (payload.type === 'menu') onMenuSelect(payload.key);
    if (payload.type === 'quick') onQuickReply(payload.key);
    if (payload.type === 'booked') onBooked(payload.booking);
    if (payload.type === 'payment') onPaymentEvent(payload.action, payload.method, payload.reason);
    if (payload.type === 'template') {
      setTemplate(payload.template);
      botReply(`เปลี่ยนเทมเพลตเป็น ${payload.template} แล้ว`);
    }
    if (payload.type === 'queue') {
      unlockStep('notify');
      unlockStep('board');
      unlockStep('signage');
      setCurrentStep('board');
      if (payload.action === 'call_next') onCallNextQueue();
      if (payload.action === 'recall') onRecallQueue();
      if (payload.action === 'near') onNearQueue();
      if (payload.action === 'advance') onAdvanceStatus();
      if (payload.action === 'add') createDemoBookingFromAdmin();
    }
    if (shouldEmit) emit(payload);
  }

  return (
    <Stack ref={motionRootRef} spacing={2}>
      <Card data-demo-intro sx={{ borderRadius: 1 }}>
        <CardContent>
          <Stack direction={{ xs: 'column', md: 'column' }} justifyContent="space-between" spacing={1.4}>
            <Box>
              <Typography variant="h5" fontWeight={900}>LINE Rich Menu + LIFF Sandbox</Typography>
              <Typography color="text.secondary">จำลองแชท LINE, เมนู Rich Menu, จองคิว LIFF, แจ้งเตือนคิว และ Signage แบบ real flow</Typography>
            </Box>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <TextField
                select
                size="small"
                label="Rich Menu Template"
                value={template}
                onChange={(e) => handleEvent({ type: 'template', template: e.target.value as DemoTemplate })}
                sx={{ minWidth: 190 }}
              >
                <MenuItem value="barber">Barber</MenuItem>
                <MenuItem value="restaurant">Restaurant/Buffet</MenuItem>
                <MenuItem value="clinic">Clinic</MenuItem>
                <MenuItem value="meeting">Meeting Room</MenuItem>
              </TextField>
              <Button onClick={() => handleEvent({ type: 'reset' })} variant="outlined" startIcon={<RefreshRoundedIcon />}>Reset Demo</Button>
              <Button onClick={() => handleEvent({ type: 'menu', key: 'booking' })} variant="contained" startIcon={<PlayArrowRoundedIcon />} sx={{ bgcolor: '#12a862', '&:hover': { bgcolor: '#5ead77' } }}>
                เริ่ม Flow จองคิว
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      <Card data-demo-intro sx={{ borderRadius: 1, border: '1px solid', borderColor: 'divider', boxShadow: 'none', bgcolor: '#fafcfa' }}>
        <CardContent sx={{ py: 1.2 }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} alignItems={{ xs: 'center', md: 'center' }}>
            <Typography variant="caption" color="text.secondary">ลำดับการทดลอง:</Typography>
            <Stack direction="row" spacing={0.8} flexWrap="wrap">
              {STEP_ORDER.map((stepKey, index) => {
                const unlocked = unlockedSteps[stepKey];
                const active = currentStep === stepKey;
                return (
                  <Chip
                    key={stepKey}
                    data-demo-step-chip
                    data-demo-active-step={active ? 'true' : undefined}
                    label={`STEP ${index + 1}`}
                    clickable={unlocked}
                    onClick={unlocked ? () => setCurrentStep(stepKey) : undefined}
                    variant={active ? 'filled' : 'outlined'}
                    sx={{
                      bgcolor: active ? '#EAF3DE' : undefined,
                      color: active ? '#0a7043' : undefined,
                      borderColor: unlocked ? undefined : '#d4dbe3',
                      opacity: unlocked ? 1 : 0.55,
                      fontWeight: 700,
                      transition: 'transform .2s ease, box-shadow .2s ease',
                      boxShadow: active ? '0 0 0 3px rgba(18,168,98,.16)' : 'none',
                      '&:hover': unlocked ? { transform: 'translateY(-2px)' } : undefined,
                    }}
                  />
                );
              })}
            </Stack>
            <Typography variant="caption" color="text.secondary">
              เริ่มจาก STEP 1 แล้วระบบจะปลดล็อกขั้นถัดไปให้อัตโนมัติ
            </Typography>
            <Button
              size="small"
              variant="outlined"
              onClick={goToNextStep}
              disabled={!nextStep || !unlockedSteps[nextStep]}
            >
              Next Step
            </Button>
            <Button
              size="small"
              variant="contained"
              onClick={startWalktour}
              sx={{ bgcolor: '#12a862', '&:hover': { bgcolor: '#5ead77' } }}
            >
              Walktour
            </Button>
          </Stack>

          <Box sx={{ mt: 1.2, height: 4, borderRadius: 99, bgcolor: '#e6ece7', overflow: 'hidden' }}>
            <Box
              data-demo-progress-fill
              sx={{
                height: '100%',
                width: `${((currentStepIndex + 1) / STEP_ORDER.length) * 100}%`,
                borderRadius: 99,
                background: 'linear-gradient(90deg, #12a862, #7bd8ad)',
              }}
            />
          </Box>
        </CardContent>
      </Card>

      {currentStep === 'chat' || currentStep === 'booking' || currentStep === 'payment' || currentStep === 'notify' ? (
        <Grid data-demo-stage container spacing={2.2}>
          {currentStep !== 'booking' ? (
            <Grid size={{ xs: 12, xl: 6 }}>
              <Card
                data-demo-panel
                data-demo-phone
                sx={{
                  borderRadius: 1,
                  overflow: 'hidden',
                  maxWidth: 420,
                  mx: 'auto',
                  width: '100%',
                }}
              >
                <CardContent sx={{ p: 0 }}>
                  <Box sx={{ px: 1.5, py: 1, borderBottom: '1px solid', borderColor: 'divider', bgcolor: '#fafcfa' }}>
                    <Typography variant="caption" color="text.secondary">STEP 1: LINE Chat Simulator (จอมือถือสำหรับลูกค้าจองคิว)</Typography>
                  </Box>
                  <LineChatSimulator messages={messages} typing={typing} onQuickReply={(k) => handleEvent({ type: 'quick', key: k })} memberProfile={memberProfile} shopName={templateConfig.shopName} />
                  <RichMenuSimulator active={activeMenu} onSelect={(key) => handleEvent({ type: 'menu', key })} labels={templateConfig.menuLabels} />
                </CardContent>
              </Card>
            </Grid>
          ) : null}

          <Grid size={{ xs: 12, xl: currentStep === 'booking' ? 12 : 6 }}>
            <Stack spacing={2} alignItems="center">
              {unlockedSteps.booking ? (
                <Card
                  data-demo-panel
                  sx={{
                    borderRadius: 1,
                    border: currentStep === 'booking' ? '2px solid #12a862' : undefined,
                    maxWidth: 420,
                    mx: 'auto',
                    width: '100%',
                  }}
                >
                  <CardContent>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.6 }}>STEP 2: LIFF Booking (สำหรับลูกค้า)</Typography>
                    <Typography fontWeight={800} sx={{ mb: 1 }}>LIFF Booking Simulator</Typography>
                    {showLiff ? <LiffBookingSimulator onBooked={(booking) => handleEvent({ type: 'booked', booking })} /> : (
                      <Box sx={{ border: '1px dashed #c6d5e2', borderRadius: 1, p: 2.2, textAlign: 'center', color: '#586677' }}>
                        จองคิวสำเร็จแล้ว กดเมนู &quot;เช็กคิว&quot; หรือ &quot;เปิด LIFF&quot; เพื่อทดลองต่อ
                      </Box>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <Card data-demo-panel sx={{ borderRadius: 1, border: '1px dashed #c6d5e2', maxWidth: 420, mx: 'auto', width: '100%' }}>
                  <CardContent>
                    <Typography variant="caption" color="text.secondary">STEP 2: LIFF Booking</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.6 }}>
                      ไปที่ STEP 1 แล้วกดเมนู &quot;จองคิว&quot; ก่อน เพื่อปลดล็อกขั้นตอนนี้
                    </Typography>
                  </CardContent>
                </Card>
              )}

              {unlockedSteps.payment && lastBooking ? (
                <Card
                  data-demo-panel
                  sx={{
                    borderRadius: 1,
                    border: currentStep === 'payment' ? '2px solid #12a862' : undefined,
                    maxWidth: 420,
                    mx: 'auto',
                    width: '100%',
                  }}
                >
                  <CardContent>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.6 }}>STEP 3: ชำระเงิน (2 แบบ)</Typography>
                    <Typography fontWeight={800} sx={{ mb: 1 }}>Payment Simulator</Typography>
                    <DemoPaymentSimulator
                      booking={lastBooking}
                      onMethodChange={(method) => handleEvent({ type: 'payment', action: 'method', method })}
                      onSlipUploaded={() => handleEvent({ type: 'payment', action: 'slip' })}
                      onPaid={() => handleEvent({ type: 'payment', action: 'paid' })}
                      onRejected={(reason) => handleEvent({ type: 'payment', action: 'reject', reason })}
                    />
                  </CardContent>
                </Card>
              ) : null}

              {unlockedSteps.notify ? (
                <Card
                  data-demo-panel
                  sx={{
                    borderRadius: 1,
                    border: currentStep === 'notify' ? '2px solid #12a862' : undefined,
                    maxWidth: 420,
                    width: '100%',
                  }}
                >
                  <CardContent>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.6 }}>STEP 4: Queue Notification (สำหรับร้านค้า)</Typography>
                    <Typography fontWeight={800} sx={{ mb: 1 }}>Queue Notification Simulator</Typography>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} flexWrap="wrap">
                      <Button variant="outlined" startIcon={<QueueRoundedIcon />} onClick={() => handleEvent({ type: 'queue', action: 'call_next' })}>เรียกคิวถัดไป</Button>
                      <Button variant="outlined" startIcon={<ReplayRoundedIcon />} onClick={() => handleEvent({ type: 'queue', action: 'recall' })}>เรียกซ้ำ</Button>
                      <Button variant="outlined" startIcon={<NotificationsActiveRoundedIcon />} onClick={() => handleEvent({ type: 'queue', action: 'near' })}>ใกล้ถึงคิว</Button>
                      <Button variant="outlined" startIcon={<AutorenewRoundedIcon />} onClick={() => handleEvent({ type: 'queue', action: 'advance' })}>เปลี่ยนสถานะ</Button>
                      <Button variant="outlined" startIcon={<AddCircleOutlineRoundedIcon />} onClick={() => handleEvent({ type: 'queue', action: 'add' })}>สร้าง booking demo</Button>
                      <Button variant="outlined" startIcon={<CampaignRoundedIcon />} onClick={() => handleEvent({ type: 'menu', key: 'promo' })}>ส่งโปรโมชัน</Button>
                      <Button variant="outlined" startIcon={<PhoneInTalkRoundedIcon />} onClick={() => handleEvent({ type: 'menu', key: 'contact' })}>จำลองตอบจากทีมงาน</Button>
                    </Stack>
                  </CardContent>
                </Card>
              ) : null}
            </Stack>
          </Grid>
        </Grid>
      ) : null}

      {unlockedSteps.board && currentStep === 'board' ? (
        <Grid data-demo-stage container spacing={2.2}>
          <Grid size={{ xs: 12 }}>
            <Card data-demo-panel ref={step5FullscreenRef} sx={{ borderRadius: 1, border: '2px solid #12a862', position: 'relative', overflow: 'visible' }}>
              <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.6 }}>
                  <Typography variant="caption" color="text.secondary">STEP 5: Queue Board (สำหรับร้าน)</Typography>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<FullscreenRoundedIcon />}
                    onClick={() => void openFullscreen('board')}
                    aria-label="Open queue board fullscreen"
                  >
                    Fullscreen
                  </Button>
                </Stack>
                <DemoQueueBoard items={queueItems} />
              </CardContent>

              <Box
                data-demo-phone
                sx={{
                  position: 'absolute',
                  right: { xs: 10, md: 18 },
                  bottom: { xs: -52, md: -64 },
                  width: { xs: 112, md: 132 },
                  zIndex: 10,
                  bgcolor: '#1a1a2e',
                  border: '2px solid #3a3a5c',
                  borderRadius: '18px',
                  p: 0.6,
                  boxShadow: '0 10px 26px rgba(0,0,0,.45)',
                }}
              >
                <Box sx={{ width: 28, height: 5, bgcolor: '#0d0d1a', borderRadius: '0 0 4px 4px', mx: 'auto', mb: 0.5 }} />
                <Box sx={{ borderRadius: 1.5, overflow: 'hidden', bgcolor: '#fff', height: { xs: 170, md: 192 } }}>
                  <Box sx={{ transform: { xs: 'scale(0.26)', md: 'scale(0.31)' }, transformOrigin: 'top left', width: 390, height: 620 }}>
                    <LineChatSimulator
                      messages={messages}
                      typing={typing}
                      onQuickReply={(k) => handleEvent({ type: 'quick', key: k })}
                      memberProfile={memberProfile}
                      shopName={templateConfig.shopName}
                    />
                    <RichMenuSimulator
                      active={activeMenu}
                      onSelect={(key) => handleEvent({ type: 'menu', key })}
                      labels={templateConfig.menuLabels}
                    />
                  </Box>
                </Box>
                <Box sx={{ width: 18, height: 3, bgcolor: '#3a3a5c', borderRadius: 99, mx: 'auto', mt: 0.45 }} />
              </Box>
            </Card>
          </Grid>

        </Grid>
      ) : null}

      {unlockedSteps.signage && currentStep === 'signage' ? (
        <Grid data-demo-stage container spacing={2.2}>

          <Grid size={{ xs: 12 }}>
            <Card data-demo-panel ref={step6FullscreenRef} sx={{ borderRadius: 1, border: '2px solid #12a862' }}>
              <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.6 }}>
                  <Typography variant="caption" color="text.secondary">STEP 6: Signage View (แสดงจอในร้าน)</Typography>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<FullscreenRoundedIcon />}
                    onClick={() => void openFullscreen('signage')}
                    aria-label="Open signage fullscreen"
                  >
                    Fullscreen
                  </Button>
                </Stack>
                <DemoSignage items={queueItems} />
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      ) : null}

      <Dialog open={walktourOpen} onClose={() => setWalktourOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ pb: 0.8 }}>
          {activeWalktourStep?.title}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            {activeWalktourStep?.description}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1.2, display: 'block' }}>
            ขั้นตอน {walktourIndex + 1} / {walktourSteps.length}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 1.6 }}>
          <Button onClick={() => setWalktourOpen(false)}>ปิด</Button>
          <Button onClick={() => moveWalktour('prev')} disabled={walktourIndex === 0}>ก่อนหน้า</Button>
          <Button variant="contained" onClick={() => moveWalktour('next')} sx={{ bgcolor: '#12a862', '&:hover': { bgcolor: '#5ead77' } }}>
            {walktourIndex >= walktourSteps.length - 1 ? 'เสร็จสิ้น' : 'ถัดไป'}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
