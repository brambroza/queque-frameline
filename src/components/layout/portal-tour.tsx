'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import HelpOutlineRoundedIcon from '@mui/icons-material/HelpOutlineRounded';
import { Box, Button, IconButton, Paper, Portal, Typography } from '@mui/material';

const TOUR_VERSION = 'v1';
/** ปิด tour guide ทั้งหมด (ทั้ง auto-start และปุ่มช่วยเหลือ) — เปลี่ยนเป็น true เพื่อเปิดใช้งานอีกครั้ง */
const TOUR_ENABLED: boolean = false;

type Step = { selector: string; title: string; body: string };

function visibleTarget(selector: string) {
  return Array.from(document.querySelectorAll<HTMLElement>(selector)).find((element) => {
    const bounds = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    return bounds.width > 0 && bounds.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
  }) ?? null;
}

function labelForPath(pathname: string) {
  const last = pathname.split('/').filter(Boolean).at(-1) ?? 'portal';
  const labels: Record<string, string> = {
    dashboard: 'แดชบอร์ด', bookings: 'การจอง', calendar: 'ปฏิทิน', 'queue-board': 'บอร์ดคิว',
    'queue-display': 'จอแสดงคิว', branches: 'สาขา', services: 'บริการ', resources: 'ทรัพยากร',
    'working-hours': 'เวลาทำการ', holidays: 'วันหยุด', staff: 'พนักงาน', customers: 'ลูกค้า',
    'line-settings': 'ตั้งค่า LINE', 'chat-inbox': 'กล่องข้อความ', notifications: 'การแจ้งเตือน',
    reports: 'รายงาน', settings: 'ตั้งค่าร้าน', 'payment-settings': 'การชำระเงิน', 'payment-verification': 'ตรวจสอบการชำระเงิน',
  };
  return labels[last] ?? last.replace(/-/g, ' ');
}

export function PortalTour() {
  const pathname = usePathname();
  const storageKey = `queue-booking:portal-tour:${TOUR_VERSION}:${pathname}`;
  const [stepIndex, setStepIndex] = useState(-1);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const pageLabel = useMemo(() => labelForPath(pathname), [pathname]);
  const steps = useMemo<Step[]>(() => [
    { selector: '[data-tour="portal-nav"]', title: 'เมนูหลัก', body: 'เลือกหน้าที่ต้องการใช้งานได้จากเมนูนี้ เช่น การจอง ปฏิทิน และรายงาน' },
    { selector: '[data-tour="portal-toolbar"]', title: 'เครื่องมือของคุณ', body: 'สลับภาษา ดูการแจ้งเตือน และจัดการโปรไฟล์ได้จากแถบด้านบน' },
    { selector: '[data-tour="page-heading"]', title: `ยินดีต้อนรับสู่หน้า${pageLabel}`, body: 'เริ่มต้นจากหัวข้อและคำอธิบายของหน้านี้ เพื่อดูสิ่งที่จัดการได้' },
    { selector: '[data-tour="page-content"]', title: 'พื้นที่ทำงาน', body: 'ข้อมูล การค้นหา และปุ่มดำเนินการของหน้านี้จะแสดงอยู่ในส่วนนี้' },
  ], [pageLabel]);

  const finish = useCallback(() => {
    try { localStorage.setItem(storageKey, 'done'); } catch { /* storage may be unavailable */ }
    setStepIndex(-1);
  }, [storageKey]);

  const start = useCallback(() => setStepIndex(0), []);

  useEffect(() => {
    setStepIndex(-1);
    if (!TOUR_ENABLED) return;
    const timer = window.setTimeout(() => {
      try {
        if (!localStorage.getItem(storageKey)) setStepIndex(0);
      } catch { setStepIndex(0); }
    }, 450);
    return () => window.clearTimeout(timer);
  }, [storageKey]);

  useEffect(() => {
    if (stepIndex < 0) return;
    const update = () => {
      const target = visibleTarget(steps[stepIndex]?.selector) ?? visibleTarget('[data-tour="page-content"]');
      if (!target) return setRect(null);
      target.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      setRect(target.getBoundingClientRect());
    };
    update();
    const visualViewport = window.visualViewport;
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    visualViewport?.addEventListener('resize', update);
    visualViewport?.addEventListener('scroll', update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
      visualViewport?.removeEventListener('resize', update);
      visualViewport?.removeEventListener('scroll', update);
    };
  }, [stepIndex, steps]);

  const next = () => {
    if (stepIndex >= steps.length - 1) finish();
    else setStepIndex((current) => current + 1);
  };

  const active = TOUR_ENABLED && stepIndex >= 0 ? steps[stepIndex] : null;
  const isOpen = Boolean(active);
  const visualViewport = typeof window === 'undefined' ? null : window.visualViewport;
  const viewportHeight = visualViewport?.height ?? (typeof window === 'undefined' ? 900 : window.innerHeight);
  const viewportWidth = visualViewport?.width ?? (typeof window === 'undefined' ? 1200 : window.innerWidth);
  const viewportOffsetTop = visualViewport?.offsetTop ?? 0;
  const viewportOffsetLeft = visualViewport?.offsetLeft ?? 0;
  const isCompactViewport = viewportWidth < 600;
  const popoverWidth = Math.min(344, viewportWidth - 32);
  const popoverHeight = 230;
  const preferredTop = rect ? rect.bottom + 14 : 80;
  const canShowBelow = preferredTop + popoverHeight <= viewportHeight - 16;
  const popoverTop = rect
    ? Math.max(16, canShowBelow ? preferredTop : rect.top - popoverHeight - 14)
    : 80;
  const popoverLeft = rect
    ? Math.min(Math.max(rect.left, 16), Math.max(16, viewportWidth - popoverWidth - 16))
    : 16;

  if (!TOUR_ENABLED) return null;

  return (
    <>
      <IconButton data-tour="tour-help" aria-label="เปิดคู่มือหน้านี้" onClick={start} sx={{ border: '1px solid', borderColor: 'divider', display: { xs: 'none', sm: 'inline-flex' } }}>
        <HelpOutlineRoundedIcon fontSize="small" />
      </IconButton>
      {isOpen ? (
        <Portal>
          <Box sx={{ position: 'fixed', zIndex: (theme) => theme.zIndex.modal + 10, inset: 0 }} role="dialog" aria-modal="true" aria-label="คู่มือการใช้งาน">
            <Box sx={{ position: 'absolute', inset: 0, bgcolor: 'rgba(8, 24, 42, 0.48)' }} onClick={finish} />
            {rect ? <Box sx={{ position: 'fixed', top: rect.top - 5, left: rect.left - 5, width: rect.width + 10, height: rect.height + 10, border: '2px solid', borderColor: 'primary.light', borderRadius: 2, boxShadow: '0 0 0 9999px rgba(8, 24, 42, 0.48)', pointerEvents: 'none', transition: 'all .2s ease' }} /> : null}
            <Paper
              elevation={8}
              sx={{
                position: 'fixed',
                top: isCompactViewport ? viewportOffsetTop + viewportHeight - 12 : popoverTop,
                left: isCompactViewport ? viewportOffsetLeft + 12 : popoverLeft,
                width: isCompactViewport ? viewportWidth - 24 : `${popoverWidth}px`,
                maxWidth: isCompactViewport ? 'none' : 'calc(100vw - 32px)',
                maxHeight: viewportHeight - 24,
                overflowY: 'auto',
                boxSizing: 'border-box',
                transform: isCompactViewport ? 'translateY(-100%)' : 'none',
                p: { xs: 2, sm: 2.25 },
                borderRadius: 3,
              }}
            >
              <IconButton aria-label="ปิดคู่มือ" onClick={finish} size="small" sx={{ position: 'absolute', top: 10, right: 10 }}><CloseRoundedIcon fontSize="small" /></IconButton>
              <Typography variant="overline" color="primary.main" fontWeight={800} sx={{ display: 'block', pr: 4, overflowWrap: 'anywhere' }}>คู่มือการใช้งาน · {stepIndex + 1}/{steps.length}</Typography>
              <Typography variant="h6" sx={{ mt: 0.2, pr: 3, overflowWrap: 'anywhere' }}>{active?.title}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.8, lineHeight: 1.65, overflowWrap: 'anywhere' }}>{active?.body}</Typography>
              <Box sx={{ display: isCompactViewport ? 'grid' : 'flex', gridTemplateColumns: '1fr 1fr', alignItems: 'center', justifyContent: 'space-between', gap: 0.75, mt: 2.25 }}>
                <Button color="inherit" size="small" onClick={finish} sx={{ gridColumn: isCompactViewport ? '1 / -1' : undefined }}>ข้าม</Button>
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.75, gridColumn: isCompactViewport ? '1 / -1' : undefined, width: isCompactViewport ? '100%' : 'auto' }}>
                  <Button size="small" disabled={stepIndex === 0} startIcon={<ArrowBackRoundedIcon />} onClick={() => setStepIndex((current) => current - 1)} sx={{ minWidth: 0, '& .MuiButton-startIcon': { display: isCompactViewport ? 'none' : 'inherit' } }}>ย้อนกลับ</Button>
                  <Button variant="contained" size="small" endIcon={<ArrowForwardRoundedIcon />} onClick={next} sx={{ minWidth: 0, '& .MuiButton-endIcon': { display: isCompactViewport ? 'none' : 'inherit' } }}>{stepIndex === steps.length - 1 ? 'เสร็จสิ้น' : 'ถัดไป'}</Button>
                </Box>
              </Box>
            </Paper>
          </Box>
        </Portal>
      ) : null}
    </>
  );
}
