/**
 * What the driver's phone should say for each queue event. Pure and
 * browser-safe: the server uses it to build the Web Push payload, the driver
 * page uses the same copy for its in-page notification, so both channels
 * always agree (and share a `tag`, so the OS replaces instead of stacking).
 */

export type DriverAlertKind = 'called' | 'late' | 'cancelled' | 'no_show';

export type DriverAlertInput = {
  queueNo: string;
  /** Dock name; null = not assigned yet. */
  dock: string | null;
  /** `called`: nth call of this queue (1 = first). */
  callCount?: number | null;
  /** `late`: minutes left before the queue is closed, when the site auto-closes. */
  graceMinutes?: number | null;
  autoNoShow?: boolean;
};

export type DriverAlert = {
  kind: DriverAlertKind;
  title: string;
  body: string;
  /** Stable per booking + kind so a repeat replaces the previous notification. */
  tag: string;
  /** Keep on screen until dismissed (Android). */
  requireInteraction: boolean;
  vibrate: number[];
};

export type DriverPushPayload = DriverAlert & { url: string };

const CALL_PATTERN = [400, 150, 400, 150, 600];
const SOFT_PATTERN = [250, 100, 250];

/**
 * @param kind Event.
 * @param bookingId Used only for the tag.
 * @param i Facts to print.
 */
export function driverAlert(kind: DriverAlertKind, bookingId: string, i: DriverAlertInput): DriverAlert {
  const tag = `fameline-${bookingId}-${kind}`;
  switch (kind) {
    case 'called': {
      const again = (i.callCount ?? 1) > 1 ? ` (เรียกครั้งที่ ${i.callCount})` : '';
      return {
        kind, tag, requireInteraction: true, vibrate: CALL_PATTERN,
        title: `ถึงคิว ${i.queueNo} แล้ว${again}`,
        body: `เชิญนำรถเข้า${i.dock ?? 'ท่า'}ตอนนี้ หากไม่เข้าภายในเวลาที่กำหนด ระบบจะเรียกคิวถัดไป`,
      };
    }
    case 'late':
      return {
        kind, tag, requireInteraction: true, vibrate: SOFT_PATTERN,
        title: `คิว ${i.queueNo} เลยเวลานัดแล้ว`,
        body: i.autoNoShow && i.graceMinutes
          ? `ยังเข้าได้ แต่ต้องมาถึงภายใน ${i.graceMinutes} นาที ไม่เช่นนั้นระบบจะปิดคิวอัตโนมัติ`
          : 'ยังเข้าได้ กรุณารีบมาถึงคลัง หรือติดต่อเจ้าหน้าที่หากมาไม่ทัน',
      };
    case 'cancelled':
      return { kind, tag, requireInteraction: false, vibrate: SOFT_PATTERN, title: `คิว ${i.queueNo} ถูกยกเลิก`, body: 'เจ้าหน้าที่ยกเลิกคิวนี้แล้ว เปิดหน้าคิวเพื่อดูเหตุผล' };
    case 'no_show':
      return { kind, tag, requireInteraction: false, vibrate: SOFT_PATTERN, title: `คิว ${i.queueNo} ถูกปิด`, body: 'ปิดคิวเนื่องจากไม่มาตามนัด กรุณาติดต่อเจ้าหน้าที่หากต้องการนัดใหม่' };
  }
}

/**
 * Driver page: which alert (if any) a status change deserves. A repeat call
 * (status stays `called`, `call_count` goes up) alerts again.
 */
export function alertKindForChange(
  prev: { status: string; call_count: number | null } | null,
  next: { status: string; call_count: number | null },
): DriverAlertKind | null {
  if (!prev) return null;
  const s = next.status;
  if (s === 'called' && (prev.status !== 'called' || (next.call_count ?? 0) > (prev.call_count ?? 0))) return 'called';
  if (s === prev.status) return null;
  if (s === 'late' || s === 'cancelled' || s === 'no_show') return s;
  return null;
}
