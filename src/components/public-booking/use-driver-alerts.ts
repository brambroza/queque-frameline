'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { alertKindForChange, driverAlert } from '@/lib/push/driver-alerts';

export type AlertSupport =
  /** No Notification API at all (old browser, or iOS Safari not installed to the Home Screen). */
  | 'unsupported'
  /** Notification API only: alerts while the tab is open. */
  | 'inpage'
  /** Service worker + Push API: alerts even when the tab is closed. */
  | 'push';

export type DriverAlertsState = {
  support: AlertSupport;
  permission: NotificationPermission | 'unsupported';
  /** A push subscription for this booking is stored on the server. */
  subscribed: boolean;
  /** The driver turned alerts on on this device (permission granted, sound unlocked). */
  enabled: boolean;
  busy: boolean;
  error: string | null;
  /** iPhone / iPad in Safari: Web Push only works from a Home Screen web app. */
  iosNeedsInstall: boolean;
};

type BookingFacts = { id: string; status: string; call_count: number | null; queue_number: string; resource_name: string | null };

const SW_URL = '/sw.js';
const SW_SCOPE = '/driver/';
const STORAGE_PREFIX = 'fameline.alerts.';

function readFlag(key: string): boolean {
  try { return window.localStorage.getItem(STORAGE_PREFIX + key) === '1'; } catch { return false; }
}
function writeFlag(key: string, on: boolean) {
  try {
    if (on) window.localStorage.setItem(STORAGE_PREFIX + key, '1');
    else window.localStorage.removeItem(STORAGE_PREFIX + key);
  } catch { /* private mode */ }
}

/** VAPID public key (base64url) → the bytes `pushManager.subscribe` wants. */
function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = window.atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

function detectSupport(): { support: AlertSupport; iosNeedsInstall: boolean } {
  if (typeof window === 'undefined') return { support: 'unsupported', iosNeedsInstall: false };
  const hasNotification = 'Notification' in window;
  const hasPush = 'serviceWorker' in navigator && 'PushManager' in window;
  const ua = navigator.userAgent;
  const isIos = /iPhone|iPad|iPod/.test(ua) || (ua.includes('Mac') && 'ontouchend' in document);
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (!hasNotification) return { support: 'unsupported', iosNeedsInstall: isIos && !standalone };
  return { support: hasPush ? 'push' : 'inpage', iosNeedsInstall: false };
}

/** Three short rising tones — no audio asset needed, but the context must be unlocked by a tap first. */
function beep(ctx: AudioContext) {
  const t0 = ctx.currentTime;
  [880, 1175, 1568].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, t0 + i * 0.22);
    gain.gain.exponentialRampToValueAtTime(0.4, t0 + i * 0.22 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.22 + 0.2);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0 + i * 0.22);
    osc.stop(t0 + i * 0.22 + 0.21);
  });
}

/**
 * Browser-side alerts for the driver page when LINE is not in play:
 *  - one tap asks for notification permission, unlocks sound and (when the
 *    browser can) subscribes this device to Web Push for the booking;
 *  - `observe(booking)` is fed every poll result and fires sound + vibration +
 *    a system notification on call / late / closure.
 *
 * @param api Base URL of the booking's public driver API (`/api/public/driver/<token>`).
 * @param pushPublicKey VAPID public key from the page meta; null = server has no push.
 */
export function useDriverAlerts(api: string) {
  const [state, setState] = useState<DriverAlertsState>({ support: 'unsupported', permission: 'unsupported', subscribed: false, enabled: false, busy: false, error: null, iosNeedsInstall: false });
  const audioRef = useRef<AudioContext | null>(null);
  const bookingKeyRef = useRef<string | null>(null);
  const prevRef = useRef<{ status: string; call_count: number | null } | null>(null);
  // Refs so `observe` keeps one identity across renders (the page's poll effect depends on it).
  const pushKeyRef = useRef<string | null>(null);
  const enabledRef = useRef(false);

  useEffect(() => {
    const { support, iosNeedsInstall } = detectSupport();
    const permission: DriverAlertsState['permission'] = support === 'unsupported' ? 'unsupported' : Notification.permission;
    setState((s) => ({ ...s, support, iosNeedsInstall, permission }));
  }, []);

  /** Store (or refresh) this browser's push subscription for the booking. */
  const syncSubscription = useCallback(async (): Promise<boolean> => {
    const pushKey = pushKeyRef.current;
    if (!pushKey || !('serviceWorker' in navigator) || !('PushManager' in window)) return false;
    const reg = await navigator.serviceWorker.register(SW_URL, { scope: SW_SCOPE });
    await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(pushKey) });
    const json = sub.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return false;
    const res = await fetch(`${api}/push`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: json.endpoint, keys: { p256dh: json.keys.p256dh, auth: json.keys.auth }, user_agent: navigator.userAgent.slice(0, 300) }),
    });
    return res.ok;
  }, [api]);

  /** Driver tapped "เปิดแจ้งเตือน": permission + sound unlock + push subscription. */
  const enable = useCallback(async () => {
    if (state.support === 'unsupported' || state.busy) return;
    setState((s) => ({ ...s, busy: true, error: null }));
    try {
      // Sound must be unlocked inside the tap; keep the context for later alerts.
      try {
        const Ctx = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (Ctx) { audioRef.current = audioRef.current ?? new Ctx(); await audioRef.current.resume(); }
      } catch { /* no sound on this device */ }

      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setState((s) => ({ ...s, busy: false, permission, enabled: false, error: permission === 'denied' ? 'การแจ้งเตือนถูกปิดกั้นไว้ เปิดสิทธิ์แจ้งเตือนของเว็บนี้ในตั้งค่าเบราว์เซอร์แล้วลองใหม่' : 'ยังไม่ได้อนุญาตการแจ้งเตือน' }));
        return;
      }
      let subscribed = false;
      try { subscribed = await syncSubscription(); } catch { subscribed = false; }
      if (bookingKeyRef.current) writeFlag(bookingKeyRef.current, true);
      enabledRef.current = true;
      setState((s) => ({ ...s, busy: false, permission, enabled: true, subscribed, error: null }));

      // A visible confirmation so the driver knows what the alert will look like.
      try {
        const reg = await navigator.serviceWorker?.getRegistration(SW_SCOPE);
        const opts = { body: subscribed ? 'จะแจ้งเมื่อถึงคิวหรือเลยเวลานัด แม้ปิดหน้านี้ไว้' : 'จะแจ้งเมื่อถึงคิวหรือเลยเวลานัด — เปิดหน้านี้ค้างไว้', tag: 'fameline-enabled' };
        if (reg) await reg.showNotification('เปิดแจ้งเตือนแล้ว', opts); else new Notification('เปิดแจ้งเตือนแล้ว', opts);
      } catch { /* cosmetic */ }
    } catch {
      setState((s) => ({ ...s, busy: false, error: 'เปิดแจ้งเตือนไม่สำเร็จ กรุณาลองใหม่' }));
    }
  }, [state.support, state.busy, syncSubscription]);

  /** Driver turned alerts off on this device: drop the push subscription server-side. */
  const disable = useCallback(async () => {
    setState((s) => ({ ...s, busy: true }));
    try {
      const reg = await navigator.serviceWorker?.getRegistration(SW_SCOPE);
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await fetch(`${api}/push`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: sub.endpoint }) }).catch(() => undefined);
        await sub.unsubscribe().catch(() => undefined);
      }
    } finally {
      if (bookingKeyRef.current) writeFlag(bookingKeyRef.current, false);
      enabledRef.current = false;
      setState((s) => ({ ...s, busy: false, enabled: false, subscribed: false }));
    }
  }, [api]);

  /** Sound + vibration + notification for an event, whichever channel this device has. */
  const fire = useCallback(async (kind: 'called' | 'late' | 'cancelled' | 'no_show', b: BookingFacts) => {
    const a = driverAlert(kind, b.id, { queueNo: b.queue_number, dock: b.resource_name, callCount: b.call_count });
    try { navigator.vibrate?.(a.vibrate); } catch { /* unsupported */ }
    if (audioRef.current) { try { await audioRef.current.resume(); beep(audioRef.current); } catch { /* muted */ } }
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    // When the server also pushes, the same tag makes the OS replace rather than stack.
    try {
      const reg = await navigator.serviceWorker?.getRegistration(SW_SCOPE);
      const opts: NotificationOptions = { body: a.body, tag: a.tag, requireInteraction: a.requireInteraction };
      if (reg) await reg.showNotification(a.title, opts); else new Notification(a.title, opts);
    } catch { /* Android Chrome refuses page-side Notification(); the SW path covers it */ }
  }, []);

  /**
   * Feed every poll result here. The first observation only remembers the
   * baseline; later changes alert. Also re-syncs the push subscription when
   * this device had alerts on for the booking before.
   *
   * @param pushPublicKey VAPID public key from the same response; null = server has no push.
   */
  const observe = useCallback((b: BookingFacts, pushPublicKey: string | null | undefined) => {
    pushKeyRef.current = pushPublicKey ?? null;
    if (bookingKeyRef.current !== b.id) {
      bookingKeyRef.current = b.id;
      prevRef.current = { status: b.status, call_count: b.call_count };
      if (readFlag(b.id) && 'Notification' in window && Notification.permission === 'granted') {
        enabledRef.current = true;
        setState((s) => ({ ...s, enabled: true }));
        void syncSubscription().then((ok) => setState((s) => ({ ...s, subscribed: ok }))).catch(() => undefined);
      }
      return;
    }
    const kind = alertKindForChange(prevRef.current, { status: b.status, call_count: b.call_count });
    prevRef.current = { status: b.status, call_count: b.call_count };
    if (kind && enabledRef.current) void fire(kind, b);
  }, [fire, syncSubscription]);

  return { state, enable, disable, observe };
}
