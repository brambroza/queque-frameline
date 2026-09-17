import { isValidLiffId, normalizeLiffId } from '@/lib/line/liff-id';
import { LAYOUTS } from './layouts';
import type { RichMenuConfig } from './schema';

/** Thrown when the config cannot be turned into a LINE request (e.g. missing LIFF ID). */
export class RichMenuConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RichMenuConfigError';
  }
}

export type LineRichMenuAction =
  | { type: 'uri'; label: string; uri: string }
  | { type: 'message'; label: string; text: string };

export type LineRichMenuArea = {
  bounds: { x: number; y: number; width: number; height: number };
  action: LineRichMenuAction;
};

export type LineRichMenuRequest = {
  size: { width: number; height: number };
  selected: boolean;
  name: string;
  chatBarText: string;
  areas: LineRichMenuArea[];
};

export type LiffContext = {
  /** `shops.shop_key` — appended as `?shop_key=` so the LIFF page can resolve the shop even when the LIFF endpoint is the shared `/liff/booking-client`. */
  shopKey: string;
  /** `shops.liff_id` (raw value as stored; may be a full LIFF URL). */
  liffBookingId: string | null;
  /** `shops.liff_id_login_shop`. Falls back to the booking LIFF with `tab=account` when empty. */
  liffMemberId: string | null;
};

type LiffTab = 'booking' | 'account';

/**
 * Same URL shape the LIFF client and the bank-return page use
 * (`https://liff.line.me/{id}?shop_key=…&tab=…`), so a rich menu tap lands on
 * the same page as every other entry point.
 */
export function buildLiffUri(liffId: string, shopKey: string, tab: LiffTab): string {
  const params = new URLSearchParams({ shop_key: shopKey, tab });
  return `https://liff.line.me/${encodeURIComponent(liffId)}?${params.toString()}`;
}

/** Normalize + validate a stored LIFF id; returns null when unusable. */
function usableLiffId(raw: string | null | undefined): string | null {
  const id = normalizeLiffId(raw);
  return id && isValidLiffId(id) ? id : null;
}

function resolveLiff(ctx: LiffContext, kind: 'booking' | 'member'): { liffId: string; tab: LiffTab } {
  if (!ctx.shopKey) throw new RichMenuConfigError('ร้านนี้ยังไม่มี shop_key — ติดต่อผู้ดูแลระบบ');
  const booking = usableLiffId(ctx.liffBookingId);
  if (kind === 'booking') {
    if (!booking) {
      throw new RichMenuConfigError(
        ctx.liffBookingId
          ? 'LIFF ID (จองคิว) รูปแบบไม่ถูกต้อง — ต้องเป็นเช่น 2001234567-AbCdEfGh ตรวจที่ LINE Settings'
          : 'ยังไม่ได้ตั้งค่า LIFF ID (จองคิว) — ตั้งค่าที่ LINE Settings ก่อน',
      );
    }
    return { liffId: booking, tab: 'booking' };
  }
  const member = usableLiffId(ctx.liffMemberId);
  if (member) return { liffId: member, tab: 'account' };
  // No dedicated member LIFF: open the booking LIFF on its account tab.
  if (booking) return { liffId: booking, tab: 'account' };
  throw new RichMenuConfigError('ยังไม่ได้ตั้งค่า LIFF ID (สมาชิก) และไม่มี LIFF ID (จองคิว) ให้ใช้แทน — ตั้งค่าที่ LINE Settings ก่อน');
}

/** Build the `areas` array for LINE from the layout cells + button actions. */
export function buildLineAreas(config: RichMenuConfig, ctx: LiffContext): LineRichMenuArea[] {
  const layout = LAYOUTS[config.layout];
  return layout.cells.map((cell, i) => {
    const button = config.buttons[i];
    if (!button) throw new RichMenuConfigError(`ช่องที่ ${i + 1} ยังไม่มีปุ่ม`);
    return {
      bounds: { x: cell.x, y: cell.y, width: cell.width, height: cell.height },
      action: toLineAction(button.label, button.action, ctx),
    };
  });
}

function toLineAction(label: string, action: RichMenuConfig['buttons'][number]['action'], ctx: LiffContext): LineRichMenuAction {
  switch (action.type) {
    case 'liff_booking': {
      const { liffId, tab } = resolveLiff(ctx, 'booking');
      return { type: 'uri', label, uri: buildLiffUri(liffId, ctx.shopKey, tab) };
    }
    case 'liff_member': {
      const { liffId, tab } = resolveLiff(ctx, 'member');
      return { type: 'uri', label, uri: buildLiffUri(liffId, ctx.shopKey, tab) };
    }
    case 'url':
      return { type: 'uri', label, uri: action.url };
    case 'message':
      return { type: 'message', label, text: action.text };
    default:
      throw new RichMenuConfigError('ประเภทปุ่มไม่รองรับ');
  }
}

/** Full body for `POST https://api.line.me/v2/bot/richmenu`. */
export function buildRichMenuRequest(config: RichMenuConfig, ctx: LiffContext, name: string): LineRichMenuRequest {
  const layout = LAYOUTS[config.layout];
  return {
    size: { width: layout.width, height: layout.height },
    selected: true,
    name: name.slice(0, 300),
    chatBarText: config.chatBarText,
    areas: buildLineAreas(config, ctx),
  };
}
