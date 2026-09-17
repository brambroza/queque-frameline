/**
 * Rich menu layouts. Cells are integer rectangles in LINE's 2500-wide image
 * space so the rendered image and the `areas` bounds sent to LINE can never
 * disagree.
 */

export const LAYOUT_KEYS = ['hero3', 'grid3x2', 'grid2x2', 'grid3x1', 'grid2x1'] as const;
export type LayoutKey = (typeof LAYOUT_KEYS)[number];

export type LayoutCell = {
  x: number;
  y: number;
  width: number;
  height: number;
  /** Large primary cell (hero3 top row). */
  hero?: true;
};

export type LayoutDef = {
  key: LayoutKey;
  label: string;
  width: 2500;
  height: 1686 | 843;
  cells: LayoutCell[];
};

const FULL = 1686 as const;
const HALF = 843 as const;

/** Three columns: 833 / 834 / 833 so the row sums to exactly 2500. */
const COL3 = [
  { x: 0, width: 833 },
  { x: 833, width: 834 },
  { x: 1667, width: 833 },
] as const;

const row3 = (y: number): LayoutCell[] => COL3.map((c) => ({ x: c.x, y, width: c.width, height: HALF }));
const row2 = (y: number): LayoutCell[] => [
  { x: 0, y, width: 1250, height: HALF },
  { x: 1250, y, width: 1250, height: HALF },
];

export const LAYOUTS: Record<LayoutKey, LayoutDef> = {
  hero3: {
    key: 'hero3',
    label: 'ช่องใหญ่ + 3 ช่อง',
    width: 2500,
    height: FULL,
    cells: [{ x: 0, y: 0, width: 2500, height: HALF, hero: true }, ...row3(HALF)],
  },
  grid3x2: { key: 'grid3x2', label: '6 ช่อง', width: 2500, height: FULL, cells: [...row3(0), ...row3(HALF)] },
  grid2x2: { key: 'grid2x2', label: '4 ช่อง', width: 2500, height: FULL, cells: [...row2(0), ...row2(HALF)] },
  grid3x1: { key: 'grid3x1', label: '3 ช่อง (ครึ่งจอ)', width: 2500, height: HALF, cells: row3(0) },
  grid2x1: { key: 'grid2x1', label: '2 ช่อง (ครึ่งจอ)', width: 2500, height: HALF, cells: row2(0) },
};

/** Image sizes LINE accepts for a rich menu. */
export const RICH_MENU_SIZES: ReadonlyArray<{ width: number; height: number }> = [
  { width: 2500, height: 1686 },
  { width: 2500, height: 843 },
];

/** Whether `width × height` is a size LINE accepts. */
export function isAllowedRichMenuSize(width: number, height: number): boolean {
  return RICH_MENU_SIZES.some((s) => s.width === width && s.height === height);
}
