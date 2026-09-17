import { describe, expect, it } from 'vitest';
import { BUSINESS_TYPES } from './business-types';
import { LAYOUT_KEYS, LAYOUTS } from './layouts';
import { buildLineAreas, buildRichMenuRequest, RichMenuConfigError } from './line-request';
import { RichMenuConfigSchema } from './schema';
import { refitButtonsForLayout, templateForBusiness } from './templates';

describe('templates', () => {
  it.each([...BUSINESS_TYPES, null])('template for %s passes the schema', (type) => {
    const cfg = templateForBusiness(type);
    const parsed = RichMenuConfigSchema.safeParse(cfg);
    expect(parsed.success, JSON.stringify(parsed.success ? null : parsed.error.issues)).toBe(true);
    expect(cfg.buttons).toHaveLength(LAYOUTS[cfg.layout].cells.length);
    expect(cfg.buttons[0].action.type).toBe('liff_booking');
  });

  it('returns a fresh copy each time', () => {
    const a = templateForBusiness('salon');
    const b = templateForBusiness('salon');
    a.buttons[0].label = 'changed';
    expect(b.buttons[0].label).not.toBe('changed');
  });

  it.each(LAYOUT_KEYS)('refitButtonsForLayout fits %s', (layout) => {
    const cfg = templateForBusiness('consult'); // 2 buttons
    const buttons = refitButtonsForLayout(cfg, layout);
    expect(buttons).toHaveLength(LAYOUTS[layout].cells.length);
    expect(buttons[0]).toEqual(cfg.buttons[0]);
    const parsed = RichMenuConfigSchema.safeParse({ ...cfg, layout, buttons });
    expect(parsed.success).toBe(true);
  });
});

describe('RichMenuConfigSchema', () => {
  it('rejects a button count that does not match the layout', () => {
    const cfg = templateForBusiness('clinic');
    const parsed = RichMenuConfigSchema.safeParse({ ...cfg, buttons: cfg.buttons.slice(0, 5) });
    expect(parsed.success).toBe(false);
  });

  it('rejects long labels, long chat bar text, and http urls', () => {
    const cfg = templateForBusiness('consult');
    expect(RichMenuConfigSchema.safeParse({ ...cfg, chatBarText: 'x'.repeat(15) }).success).toBe(false);
    const longLabel = { ...cfg, buttons: [{ ...cfg.buttons[0], label: 'x'.repeat(21) }, cfg.buttons[1]] };
    expect(RichMenuConfigSchema.safeParse(longLabel).success).toBe(false);
    const httpUrl = { ...cfg, buttons: [cfg.buttons[0], { ...cfg.buttons[1], action: { type: 'url', url: 'http://x.com' } }] };
    expect(RichMenuConfigSchema.safeParse(httpUrl).success).toBe(false);
  });
});

describe('buildLineAreas', () => {
  const ctx = { shopKey: 'SHOP-ABC123', liffBookingId: '1234567890-abcdefgh', liffMemberId: '1234567890-ijklmnop' };

  it('produces one area per cell with matching bounds', () => {
    const cfg = templateForBusiness('restaurant');
    const areas = buildLineAreas(cfg, ctx);
    expect(areas).toHaveLength(6);
    areas.forEach((a, i) => {
      const c = LAYOUTS.grid3x2.cells[i];
      expect(a.bounds).toEqual({ x: c.x, y: c.y, width: c.width, height: c.height });
    });
    expect(areas[0].action).toEqual({ type: 'uri', label: 'จองโต๊ะ', uri: 'https://liff.line.me/1234567890-abcdefgh?shop_key=SHOP-ABC123&tab=booking' });
    expect(areas[1].action).toEqual({ type: 'uri', label: 'เช็คคิว', uri: 'https://liff.line.me/1234567890-ijklmnop?shop_key=SHOP-ABC123&tab=account' });
    expect(areas[5].action.type).toBe('message');
  });

  it('throws RichMenuConfigError when the booking LIFF id is missing or malformed', () => {
    const cfg = templateForBusiness('salon');
    expect(() => buildLineAreas(cfg, { shopKey: 'SHOP-ABC123', liffBookingId: null, liffMemberId: null })).toThrow(RichMenuConfigError);
    expect(() => buildLineAreas(cfg, { ...ctx, liffBookingId: 'not-a-liff-id' })).toThrow(/รูปแบบไม่ถูกต้อง/);
    expect(() => buildLineAreas(cfg, { ...ctx, shopKey: '' })).toThrow(/shop_key/);
  });

  it('accepts a pasted LIFF URL by normalizing it to the bare id', () => {
    const cfg = templateForBusiness('consult'); // grid2x1: booking + message
    const areas = buildLineAreas(cfg, { ...ctx, liffBookingId: 'https://liff.line.me/1234567890-abcdefgh' });
    expect(areas[0].action).toEqual({ type: 'uri', label: 'นัดปรึกษา', uri: 'https://liff.line.me/1234567890-abcdefgh?shop_key=SHOP-ABC123&tab=booking' });
    expect(areas[1].action).toEqual({ type: 'message', label: 'ติดต่อ', text: 'ติดต่อสอบถาม' });
  });

  it('falls back to the booking LIFF (account tab) when no member LIFF is set', () => {
    const cfg = templateForBusiness('salon');
    const areas = buildLineAreas(cfg, { ...ctx, liffMemberId: null });
    expect(areas[1].action).toEqual({ type: 'uri', label: 'สมาชิก', uri: 'https://liff.line.me/1234567890-abcdefgh?shop_key=SHOP-ABC123&tab=account' });
  });

  it('buildRichMenuRequest carries size + chat bar text', () => {
    const req = buildRichMenuRequest(templateForBusiness('mobile_repair'), ctx, 'QueueBooking – ร้าน');
    expect(req.size).toEqual({ width: 2500, height: 843 });
    expect(req.chatBarText).toBe('จองซ่อม');
    expect(req.selected).toBe(true);
    expect(req.areas).toHaveLength(3);
  });
});
