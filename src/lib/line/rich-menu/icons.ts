/**
 * Rich menu glyphs, hand-drawn in a 24×24 viewBox. `c` is the main color,
 * `k` the knockout color (cut-outs / secondary strokes). Pure strings so the
 * same definitions work in the browser (canvas) and on the server (resvg).
 */

export const ICON_KEYS = [
  'booking',
  'member',
  'queue',
  'contact',
  'services',
  'location',
  'hours',
  'promo',
  'scissors',
  'nail',
  'cross',
  'food',
  'table',
  'dumbbell',
  'room',
  'wrench',
  'car',
  'phone',
  'hardhat',
  'document',
  'talk',
] as const;

export type IconKey = (typeof ICON_KEYS)[number];

export type IconDef = {
  key: IconKey;
  /** Thai name shown in pickers. */
  name: string;
  svg: (c: string, k: string) => string;
};

export const ICONS: Record<IconKey, IconDef> = {
  booking: {
    key: 'booking',
    name: 'ปฏิทินจอง',
    svg: (c, k) => `
      <rect x="2.4" y="4" width="14.4" height="14" rx="3.2" fill="${c}"/>
      <rect x="5.6" y="1.8" width="2.2" height="4.4" rx="1.1" fill="${c}"/>
      <rect x="11.4" y="1.8" width="2.2" height="4.4" rx="1.1" fill="${c}"/>
      <path d="M6.3 11.4l2.3 2.3 4.1-4.4" fill="none" stroke="${k}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="17.6" cy="17.4" r="5.6" fill="${k}"/>
      <circle cx="17.6" cy="17.4" r="4.4" fill="${c}"/>
      <path d="M17.6 14.9v2.7h2" fill="none" stroke="${k}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>`,
  },
  member: {
    key: 'member',
    name: 'สมาชิก',
    svg: (c, k) => `
      <rect x="10.6" y="7" width="12.4" height="9.6" rx="2.4" fill="${c}"/>
      <circle cx="15.2" cy="10.8" r="1.7" fill="${k}"/>
      <rect x="18" y="9.9" width="4.2" height="1.5" rx="0.75" fill="${k}"/>
      <rect x="18" y="12.7" width="4.2" height="1.5" rx="0.75" fill="${k}"/>
      <circle cx="7.2" cy="6.9" r="3.9" fill="${c}"/>
      <path d="M1 20.4c0-3.4 2.8-6.2 6.2-6.2s6.2 2.8 6.2 6.2z" fill="${c}"/>`,
  },
  queue: {
    key: 'queue',
    name: 'เช็คคิว',
    svg: (c, k) => `
      <rect x="2.2" y="2.8" width="15.6" height="18.4" rx="3.2" fill="${c}"/>
      <rect x="5.2" y="6.6" width="7.6" height="1.9" rx="0.95" fill="${k}"/>
      <rect x="5.2" y="10.4" width="9.6" height="1.9" rx="0.95" fill="${k}"/>
      <rect x="5.2" y="14.2" width="5.6" height="1.9" rx="0.95" fill="${k}"/>
      <circle cx="17.8" cy="17.2" r="5.8" fill="${k}"/>
      <circle cx="17.8" cy="17.2" r="4.6" fill="${c}"/>
      <path d="M15.8 17.3l1.5 1.5 2.6-2.9" fill="none" stroke="${k}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>`,
  },
  contact: {
    key: 'contact',
    name: 'แชท / ติดต่อ',
    svg: (c, k) => `
      <rect x="1.8" y="3" width="20.4" height="14.4" rx="4.2" fill="${c}"/>
      <path d="M7.4 15.6h5.4l-4.6 6.6z" fill="${c}"/>
      <circle cx="7.6" cy="10.2" r="1.6" fill="${k}"/>
      <circle cx="12" cy="10.2" r="1.6" fill="${k}"/>
      <circle cx="16.4" cy="10.2" r="1.6" fill="${k}"/>`,
  },
  services: {
    key: 'services',
    name: 'บริการ',
    svg: (c, k) => `
      <rect x="2.2" y="2.2" width="8.8" height="8.8" rx="2.6" fill="${c}"/>
      <rect x="13" y="2.2" width="8.8" height="8.8" rx="2.6" fill="${c}"/>
      <rect x="2.2" y="13" width="8.8" height="8.8" rx="2.6" fill="${c}"/>
      <rect x="13" y="13" width="8.8" height="8.8" rx="2.6" fill="${c}"/>
      <path d="M15.2 17.4l1.6 1.6 3-3.4" fill="none" stroke="${k}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`,
  },
  location: {
    key: 'location',
    name: 'แผนที่',
    svg: (c, k) => `
      <path d="M12 1.4c-4.5 0-8.1 3.6-8.1 8.1 0 5.8 8.1 13.1 8.1 13.1s8.1-7.3 8.1-13.1c0-4.5-3.6-8.1-8.1-8.1z" fill="${c}"/>
      <circle cx="12" cy="9.4" r="3.2" fill="${k}"/>`,
  },
  hours: {
    key: 'hours',
    name: 'เวลาทำการ',
    svg: (c, k) => `
      <circle cx="12" cy="12" r="9.8" fill="${c}"/>
      <path d="M12 6.2V12l4.1 2.5" fill="none" stroke="${k}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
  },
  promo: {
    key: 'promo',
    name: 'โปรโมชัน',
    svg: (c, k) => `
      <path d="M11.6 1.8H20a2.2 2.2 0 0 1 2.2 2.2v8.4a2.4 2.4 0 0 1-0.7 1.7l-7.4 7.4a2.4 2.4 0 0 1-3.4 0l-8-8a2.4 2.4 0 0 1 0-3.4l7.4-7.4a2.4 2.4 0 0 1 1.5-0.9z" fill="${c}"/>
      <circle cx="17.2" cy="6.8" r="2.1" fill="${k}"/>`,
  },
  scissors: {
    key: 'scissors',
    name: 'กรรไกร',
    svg: (c) => `
      <circle cx="6" cy="6" r="3.2" fill="none" stroke="${c}" stroke-width="2.4"/>
      <circle cx="6" cy="18" r="3.2" fill="none" stroke="${c}" stroke-width="2.4"/>
      <path d="M8.6 7.8L21 16.6M8.6 16.2L21 7.4" stroke="${c}" stroke-width="2.4" stroke-linecap="round"/>`,
  },
  nail: {
    key: 'nail',
    name: 'ทาเล็บ',
    svg: (c, k) => `
      <rect x="8.5" y="2" width="7" height="5" rx="1.5" fill="${c}"/>
      <rect x="6.5" y="7" width="11" height="15" rx="3" fill="${c}"/>
      <path d="M9.5 12h5M9.5 15.5h5" stroke="${k}" stroke-width="1.6" stroke-linecap="round"/>`,
  },
  cross: {
    key: 'cross',
    name: 'การแพทย์',
    svg: (c, k) => `
      <rect x="2" y="2" width="20" height="20" rx="5" fill="${c}"/>
      <path d="M12 7v10M7 12h10" stroke="${k}" stroke-width="3" stroke-linecap="round"/>`,
  },
  food: {
    key: 'food',
    name: 'อาหาร',
    svg: (c) => `
      <path d="M5 2v8a3 3 0 0 0 3 3v9M8 2v6M11 2v6" stroke="${c}" stroke-width="2.4" stroke-linecap="round" fill="none"/>
      <path d="M18 2c-2.5 0-4 3-4 6.5 0 2 1 3.5 2.5 3.5V22" stroke="${c}" stroke-width="2.4" stroke-linecap="round" fill="none"/>`,
  },
  table: {
    key: 'table',
    name: 'โต๊ะ',
    svg: (c) => `
      <ellipse cx="12" cy="7" rx="10" ry="3.5" fill="${c}"/>
      <path d="M4 9v9M20 9v9M12 10.5V22M6 22h12" stroke="${c}" stroke-width="2.4" stroke-linecap="round"/>`,
  },
  dumbbell: {
    key: 'dumbbell',
    name: 'ดัมเบล',
    svg: (c) => `
      <rect x="2" y="9" width="3" height="6" rx="1" fill="${c}"/>
      <rect x="5" y="7" width="3.5" height="10" rx="1" fill="${c}"/>
      <rect x="15.5" y="7" width="3.5" height="10" rx="1" fill="${c}"/>
      <rect x="19" y="9" width="3" height="6" rx="1" fill="${c}"/>
      <rect x="8.5" y="10.5" width="7" height="3" fill="${c}"/>`,
  },
  room: {
    key: 'room',
    name: 'ห้อง',
    svg: (c, k) => `
      <rect x="2" y="3" width="20" height="18" rx="3" fill="${c}"/>
      <rect x="5" y="6" width="14" height="6" rx="1.5" fill="${k}"/>
      <rect x="5" y="14" width="4" height="4" rx="1" fill="${k}"/>
      <rect x="10" y="14" width="4" height="4" rx="1" fill="${k}"/>
      <rect x="15" y="14" width="4" height="4" rx="1" fill="${k}"/>`,
  },
  wrench: {
    key: 'wrench',
    name: 'ประแจ',
    svg: (c) => `
      <path d="M21.5 6.5a5 5 0 0 1-6.6 6.2L7.4 20.2a2.3 2.3 0 0 1-3.3-3.3l7.5-7.5a5 5 0 0 1 6.2-6.6l-3 3 .8 2.9 2.9.8z" fill="${c}"/>`,
  },
  car: {
    key: 'car',
    name: 'รถยนต์',
    svg: (c, k) => `
      <path d="M4 12l2-5.5A2 2 0 0 1 7.9 5h8.2a2 2 0 0 1 1.9 1.5L20 12v6a1 1 0 0 1-1 1h-1.5a1 1 0 0 1-1-1v-1h-9v1a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z" fill="${c}"/>
      <circle cx="7.5" cy="14" r="1.5" fill="${k}"/>
      <circle cx="16.5" cy="14" r="1.5" fill="${k}"/>`,
  },
  phone: {
    key: 'phone',
    name: 'มือถือ',
    svg: (c, k) => `
      <rect x="6" y="1.5" width="12" height="21" rx="3" fill="${c}"/>
      <rect x="8" y="4.5" width="8" height="12" rx="1" fill="${k}"/>
      <circle cx="12" cy="19.2" r="1.2" fill="${k}"/>`,
  },
  hardhat: {
    key: 'hardhat',
    name: 'หมวกช่าง',
    svg: (c, k) => `
      <path d="M3 15a9 9 0 0 1 18 0z" fill="${c}"/>
      <rect x="2" y="15" width="20" height="3.5" rx="1.5" fill="${c}"/>
      <rect x="10.5" y="5" width="3" height="6" fill="${k}"/>`,
  },
  document: {
    key: 'document',
    name: 'เอกสาร',
    svg: (c, k) => `
      <path d="M6 2h8l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" fill="${c}"/>
      <path d="M14 2v5h5" fill="${k}"/>
      <path d="M8 12h8M8 16h6" stroke="${k}" stroke-width="1.8" stroke-linecap="round"/>`,
  },
  talk: {
    key: 'talk',
    name: 'ปรึกษา',
    svg: (c) => `
      <path d="M2 4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H8l-4 3v-3H4a2 2 0 0 1-2-2z" fill="${c}"/>
      <path d="M22 11a2 2 0 0 0-2-2h-2v3a3 3 0 0 1-3 3H10v1a2 2 0 0 0 2 2h4l4 3v-3a2 2 0 0 0 2-2z" fill="${c}"/>`,
  },
};

/** Type guard for an icon key. */
export function isIconKey(value: unknown): value is IconKey {
  return typeof value === 'string' && (ICON_KEYS as readonly string[]).includes(value);
}

/** Full standalone SVG document for one glyph at `size` px. */
export function buildIconSvg(key: IconKey, mainColor: string, knockoutColor: string, size: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24">${ICONS[key].svg(mainColor, knockoutColor)}</svg>`;
}

/** `data:` URL for an icon SVG — usable as `<img src>` or canvas image source. */
export function iconDataUrl(key: IconKey, mainColor: string, knockoutColor: string, size: number): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(buildIconSvg(key, mainColor, knockoutColor, size))}`;
}
