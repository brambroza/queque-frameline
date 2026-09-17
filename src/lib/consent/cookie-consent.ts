/**
 * Cookie consent (PDPA) — เก็บสถานะความยินยอมของผู้ใช้ไว้ใน localStorage
 *
 * หมวดคุกกี้:
 * - necessary: จำเป็นต่อการทำงานของระบบ (เปิดเสมอ ปิดไม่ได้)
 * - analytics: วิเคราะห์การใช้งาน (เช่น PostHog) — ต้อง opt-in
 * - marketing: การตลาด/โฆษณา — ต้อง opt-in
 *
 * เมื่อค่าเปลี่ยน จะยิง event `qb-consent-change` บน window เพื่อให้ส่วนอื่น (เช่น analytics) ปรับตาม
 */

export const CONSENT_KEY = 'qb-cookie-consent';
/** เพิ่มเวอร์ชันเมื่อนโยบายคุกกี้เปลี่ยน เพื่อขอความยินยอมใหม่ */
export const CONSENT_VERSION = 1;
export const CONSENT_EVENT = 'qb-consent-change';

export type ConsentCategory = 'necessary' | 'analytics' | 'marketing';

export type ConsentState = {
  necessary: true;
  analytics: boolean;
  marketing: boolean;
  version: number;
  updatedAt: string;
};

export const ACCEPT_ALL: Omit<ConsentState, 'version' | 'updatedAt'> = {
  necessary: true,
  analytics: true,
  marketing: true,
};

export const REJECT_ALL: Omit<ConsentState, 'version' | 'updatedAt'> = {
  necessary: true,
  analytics: false,
  marketing: false,
};

/** อ่าน consent ปัจจุบัน — คืน null ถ้ายังไม่เคยเลือก หรือเวอร์ชันเก่า */
export function getConsent(): ConsentState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(CONSENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ConsentState;
    if (parsed.version !== CONSENT_VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** มีความยินยอมที่ยังใช้ได้อยู่หรือไม่ (ใช้ตัดสินใจว่าจะโชว์ banner ไหม) */
export function hasConsent(): boolean {
  return getConsent() !== null;
}

/** บันทึก consent แล้วยิง event ให้ส่วนอื่นรับรู้ */
export function saveConsent(choice: Omit<ConsentState, 'version' | 'updatedAt'>): ConsentState {
  const state: ConsentState = {
    ...choice,
    necessary: true,
    version: CONSENT_VERSION,
    updatedAt: new Date().toISOString(),
  };
  try {
    window.localStorage.setItem(CONSENT_KEY, JSON.stringify(state));
    window.dispatchEvent(new CustomEvent<ConsentState>(CONSENT_EVENT, { detail: state }));
  } catch {
    /* ignore */
  }
  return state;
}
