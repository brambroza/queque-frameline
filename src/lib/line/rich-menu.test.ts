import { describe, expect, it } from 'vitest';
import { actionForText, parsePostback, pngDimensions, postbackData, RICH_MENU_SIZE, RICH_MENU_TILES, richMenuImageProblem, richMenuRequest, tileBounds } from './rich-menu';

/** Minimal PNG header (signature + IHDR length/type + width/height) — enough for `pngDimensions`. */
function pngHeader(width: number, height: number, pad = 0): Uint8Array {
  const b = new Uint8Array(24 + pad);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52], 0);
  new DataView(b.buffer).setUint32(16, width);
  new DataView(b.buffer).setUint32(20, height);
  return b;
}

describe('rich menu layout', () => {
  it('splits the compact menu into equal tiles that cover the full width', () => {
    const bounds = tileBounds();
    expect(bounds).toHaveLength(RICH_MENU_TILES.length);
    expect(bounds[0].x).toBe(0);
    bounds.forEach((b, i) => {
      expect(b.y).toBe(0);
      expect(b.height).toBe(RICH_MENU_SIZE.height);
      if (i > 0) expect(b.x).toBe(bounds[i - 1].x + bounds[i - 1].width);
    });
    const last = bounds[bounds.length - 1];
    expect(last.x + last.width).toBe(RICH_MENU_SIZE.width);
  });

  it('builds a LINE request with one postback area per tile', () => {
    const req = richMenuRequest();
    expect(req.size).toEqual({ width: 2500, height: 843 });
    expect(req.selected).toBe(true);
    expect(req.areas.map((a) => a.action.data)).toEqual(['action=my_queues', 'action=my_docs', 'action=contact']);
    expect(req.areas.map((a) => a.action.displayText)).toEqual(RICH_MENU_TILES.map((t) => t.label));
    expect(richMenuRequest({ version: 3 }).name).toBe('fameline-customer-v3');
  });
});

describe('postback / text parsing', () => {
  it('round-trips postback data and rejects anything else', () => {
    for (const t of RICH_MENU_TILES) expect(parsePostback(postbackData(t.action))).toBe(t.action);
    expect(parsePostback('action=delete_everything')).toBeNull();
    expect(parsePostback('action=my_queues&x=1')).toBeNull();
    expect(parsePostback(undefined)).toBeNull();
    expect(parsePostback('')).toBeNull();
  });

  it('maps typed keywords to the same actions, ignoring spaces and case', () => {
    expect(actionForText('คิว')).toBe('my_queues');
    expect(actionForText(' เช็ค คิว ')).toBe('my_queues');
    expect(actionForText('สถานะ SO')).toBe('my_docs');
    expect(actionForText('so')).toBe('my_docs');
    expect(actionForText('ติดต่อคลัง')).toBe('contact');
    expect(actionForText('สวัสดีครับ')).toBeNull();
    expect(actionForText('')).toBeNull();
  });
});

describe('image validation', () => {
  it('reads PNG dimensions and rejects non-PNG bytes', () => {
    expect(pngDimensions(pngHeader(2500, 843))).toEqual({ width: 2500, height: 843 });
    expect(pngDimensions(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]))).toBeNull();
    expect(pngDimensions(new Uint8Array(3))).toBeNull();
  });

  it('accepts only a 2500×843 PNG under 1 MB', () => {
    expect(richMenuImageProblem(pngHeader(2500, 843))).toBeNull();
    expect(richMenuImageProblem(pngHeader(2500, 1686))).toMatch(/ขนาดภาพ/);
    expect(richMenuImageProblem(new Uint8Array(30))).toBe('ภาพต้องเป็น PNG');
    expect(richMenuImageProblem(pngHeader(2500, 843, 1_048_576))).toMatch(/1 MB/);
  });
});
