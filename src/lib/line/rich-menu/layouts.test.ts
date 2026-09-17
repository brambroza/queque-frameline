import { describe, expect, it } from 'vitest';
import { isAllowedRichMenuSize, LAYOUT_KEYS, LAYOUTS } from './layouts';

describe('LAYOUTS', () => {
  it.each(LAYOUT_KEYS)('%s tiles the image exactly with integer cells inside bounds', (key) => {
    const layout = LAYOUTS[key];
    const area = layout.cells.reduce((sum, c) => sum + c.width * c.height, 0);
    expect(area).toBe(layout.width * layout.height);
    for (const c of layout.cells) {
      expect(Number.isInteger(c.x) && Number.isInteger(c.y) && Number.isInteger(c.width) && Number.isInteger(c.height)).toBe(true);
      expect(c.x).toBeGreaterThanOrEqual(0);
      expect(c.y).toBeGreaterThanOrEqual(0);
      expect(c.x + c.width).toBeLessThanOrEqual(layout.width);
      expect(c.y + c.height).toBeLessThanOrEqual(layout.height);
    }
  });

  it.each(LAYOUT_KEYS)('%s has no overlapping cells', (key) => {
    const cells = LAYOUTS[key].cells;
    for (let i = 0; i < cells.length; i += 1) {
      for (let j = i + 1; j < cells.length; j += 1) {
        const a = cells[i];
        const b = cells[j];
        const overlap = a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
        expect(overlap).toBe(false);
      }
    }
  });

  it('uses only sizes LINE accepts', () => {
    for (const key of LAYOUT_KEYS) {
      const l = LAYOUTS[key];
      expect(isAllowedRichMenuSize(l.width, l.height)).toBe(true);
    }
    expect(isAllowedRichMenuSize(1200, 810)).toBe(false);
  });

  it('hero3 has exactly one hero cell on the top row', () => {
    const heroes = LAYOUTS.hero3.cells.filter((c) => c.hero);
    expect(heroes).toHaveLength(1);
    expect(heroes[0]).toMatchObject({ x: 0, y: 0, width: 2500, height: 843 });
  });
});
