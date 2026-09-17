'use client';

import { Suspense, useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import posthog from 'posthog-js';
import { PostHogProvider as PHProvider } from 'posthog-js/react';
import { CONSENT_EVENT, getConsent, type ConsentState } from '@/lib/consent/cookie-consent';
import { captureUtm, getStoredUtm } from '@/lib/analytics/track';

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';

/**
 * เริ่มต้น PostHog ฝั่ง client (ทำครั้งเดียวตอน module load)
 * ปิด capture_pageview อัตโนมัติ เพราะ App Router ใช้ client-side routing
 * เราจะ track pageview เองผ่าน PostHogPageView
 */
if (typeof window !== 'undefined' && POSTHOG_KEY && !posthog.__loaded) {
  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    defaults: '2026-05-30',
    capture_pageview: false, // จัดการเองใน PostHogPageView (รองรับ SPA navigation)

    // --- Privacy (PDPA): กัน PII ลูกค้าไหลเข้า PostHog ---
    // ปิด session recording ทั้งหมด (ไม่อัดวิดีโอ DOM ที่มีเบอร์/ชื่อลูกค้า)
    disable_session_recording: true,
    // autocapture: ไม่เก็บ text บน element และไม่เก็บ attribute เช่น value/href
    mask_all_text: true,
    mask_all_element_attributes: true,

    // --- PDPA: ไม่เก็บข้อมูลจนกว่าผู้ใช้จะยินยอม (opt-in) ---
    opt_out_capturing_by_default: true,
    // เก็บ consent state ไว้ใน localStorage เอง — persistence จะ active หลัง opt-in
    persistence: 'localStorage+cookie',
  });

  // ถ้าเคยยินยอม analytics ไว้แล้ว ให้เปิด capturing ทันที
  const consent = getConsent();
  if (consent?.analytics) posthog.opt_in_capturing();
}

/** ปรับสถานะ PostHog ตามความยินยอม (เรียกเมื่อ consent เปลี่ยน) */
function applyConsent(state: ConsentState | null) {
  if (!POSTHOG_KEY || typeof window === 'undefined') return;
  if (state?.analytics) posthog.opt_in_capturing();
  else posthog.opt_out_capturing();
}

/**
 * ส่ง event `$pageview` ทุกครั้งที่ route เปลี่ยน (รวม query string)
 */
/** หน้าที่มีข้อมูลลูกค้าจริงบนจอ — ต้อง mask autocapture ไว้เสมอ */
const MASKED_PATH_PREFIXES = ['/portal', '/liff', '/display'];

function PostHogPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!pathname || !POSTHOG_KEY) return;

    // หน้าการตลาดไม่มี PII อยู่บนจอ — ปลด mask เพื่อให้วิเคราะห์การคลิก CTA ได้
    // ส่วน portal/liff/display คงการ mask ไว้ตาม PDPA
    const shouldMask = MASKED_PATH_PREFIXES.some((p) => pathname.startsWith(p));
    posthog.set_config({ mask_all_text: shouldMask, mask_all_element_attributes: shouldMask });

    let url = window.origin + pathname;
    const qs = searchParams?.toString();
    if (qs) url += `?${qs}`;
    captureUtm(qs ? `?${qs}` : '');
    posthog.capture('$pageview', { $current_url: url, ...getStoredUtm() });
  }, [pathname, searchParams]);

  return null;
}

/** ฟังการเปลี่ยนความยินยอม แล้วเปิด/ปิด capturing ให้ตรงกัน */
function ConsentSync() {
  useEffect(() => {
    const handler = (e: Event) => applyConsent((e as CustomEvent<ConsentState>).detail);
    window.addEventListener(CONSENT_EVENT, handler);
    return () => window.removeEventListener(CONSENT_EVENT, handler);
  }, []);
  return null;
}

/**
 * ครอบแอปด้วย PostHog context + pageview tracking
 * ถ้าไม่ได้ตั้งค่า env key จะ render children เฉยๆ (no-op)
 */
export function PostHogProvider({ children }: { children: React.ReactNode }) {
  if (!POSTHOG_KEY) return <>{children}</>;

  return (
    <PHProvider client={posthog}>
      <ConsentSync />
      <Suspense fallback={null}>
        <PostHogPageView />
      </Suspense>
      {children}
    </PHProvider>
  );
}
