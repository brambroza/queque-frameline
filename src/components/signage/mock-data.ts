import type { SignageConfig, SignageData, SignagePerson, SignageTemplate, SignageTheme } from '@/lib/signage/types';
import { DEFAULT_SIGNAGE_CONFIG } from '@/lib/signage/settings';

/**
 * Sample data for the landing showcase and the designer's template thumbnails.
 * Static so it renders identically on server and client. Mixes full nicknames
 * (shown as-is) with masked real names, the way a live board looks.
 */

function person(
  id: string,
  queue_number: string,
  status: string,
  start_time: string,
  customer_name: string | null,
  service_name: string | null,
  resource_name: string | null,
  called_at: string | null = null,
): SignagePerson {
  return { id, queue_number, status, start_time, called_at, customer_name, service_name, resource_name };
}

const MOCK_DATE = '2026-09-10';
const MOCK_GENERATED = '2026-09-10T03:42:00.000Z';

const BASE: Omit<SignageData, 'now_calling' | 'next_queue' | 'waiting_queue' | 'totals'> = {
  date: MOCK_DATE,
  generated_at: MOCK_GENERATED,
  shop: { name: 'ร้านตัวอย่าง', logo_url: null, demo_mode_enabled: false },
  branch: null,
  qr_url: 'https://liff.line.me/0000000000-demo',
};

export const MOCK_SIGNAGE_RESTAURANT: SignageData = {
  ...BASE,
  shop: { ...BASE.shop, name: 'ครัวคุณแม่ สาขาลาดพร้าว' },
  now_calling: [
    person('c1', 'A12', 'called', '11:30', 'พี่แจ็ค', 'โต๊ะ 4 ที่นั่ง', 'โต๊ะ 7', '2026-09-10T04:40:00.000Z'),
    person('c2', 'A11', 'serving', '11:20', 'ณ***', 'โต๊ะ 2 ที่นั่ง', 'โต๊ะ 3', '2026-09-10T04:32:00.000Z'),
  ],
  next_queue: [
    person('n1', 'A13', 'waiting', '11:40', 'นัท', 'โต๊ะ 4 ที่นั่ง', null),
    person('n2', 'A14', 'waiting', '11:45', 'ว***', 'โต๊ะ 6 ที่นั่ง', null),
    person('n3', 'A15', 'waiting', '11:50', 'ก***', 'โต๊ะ 2 ที่นั่ง', null),
    person('n4', 'A16', 'waiting', '12:00', 'ธ***', 'โต๊ะ 4 ที่นั่ง', null),
    person('n5', 'A17', 'waiting', '12:05', 'ส***', 'โต๊ะ 8 ที่นั่ง', null),
  ],
  waiting_queue: [
    person('w1', 'A18', 'waiting', '12:10', 'อ***', null, null),
    person('w2', 'A19', 'waiting', '12:15', 'บ***', null, null),
    person('w3', 'A20', 'waiting', '12:20', 'ม***', null, null),
    person('w4', 'A21', 'waiting', '12:30', 'ป***', null, null),
  ],
  totals: { waiting: 9, calling: 2, served_today: 24 },
};

export const MOCK_SIGNAGE_CLINIC: SignageData = {
  ...BASE,
  shop: { ...BASE.shop, name: 'สุขใจคลินิก' },
  now_calling: [
    person('c1', 'B08', 'called', '10:30', 'คุณส้ม', 'ตรวจสุขภาพ', 'ห้องตรวจ 1', '2026-09-10T03:40:00.000Z'),
    person('c2', 'B07', 'in_service', '10:15', 'ณ***', 'ทันตกรรม', 'ห้องตรวจ 2', '2026-09-10T03:20:00.000Z'),
    person('c3', 'B06', 'serving', '10:00', 'ว***', 'ฉีดวัคซีน', 'ห้องตรวจ 3', '2026-09-10T03:05:00.000Z'),
  ],
  next_queue: [
    person('n1', 'B09', 'waiting', '10:45', 'พ***', 'ปรึกษาแพทย์', null),
    person('n2', 'B10', 'waiting', '11:00', 'ก***', 'ตรวจสุขภาพ', null),
    person('n3', 'B11', 'waiting', '11:15', 'ธ***', 'ทันตกรรม', null),
    person('n4', 'B12', 'waiting', '11:30', 'ส***', 'ฉีดวัคซีน', null),
    person('n5', 'B13', 'waiting', '11:45', 'อ***', 'ตรวจสุขภาพ', null),
  ],
  waiting_queue: [
    person('w1', 'B14', 'waiting', '12:00', 'บ***', null, null),
    person('w2', 'B15', 'waiting', '12:15', 'ม***', null, null),
  ],
  totals: { waiting: 7, calling: 3, served_today: 18 },
};

export const MOCK_SIGNAGE_BARBER: SignageData = {
  ...BASE,
  shop: { ...BASE.shop, name: 'Gentleman Barber' },
  now_calling: [
    person('c1', '24', 'called', '14:00', 'ศ***', 'ตัดผม + สระ', 'ช่างต้น', '2026-09-10T07:00:00.000Z'),
    person('c2', '23', 'serving', '13:30', 'ณ***', 'ตัดผม', 'ช่างบอล', '2026-09-10T06:35:00.000Z'),
  ],
  next_queue: [
    person('n1', '25', 'waiting', '14:30', 'พ***', 'โกนหนวด', null),
    person('n2', '26', 'waiting', '14:45', 'ว***', 'ตัดผม', null),
    person('n3', '27', 'waiting', '15:00', 'ก***', 'ตัดผม + สระ', null),
  ],
  waiting_queue: [person('w1', '28', 'waiting', '15:30', 'ธ***', null, null)],
  totals: { waiting: 4, calling: 2, served_today: 12 },
};

export const MOCK_SIGNAGE_NAIL: SignageData = {
  ...BASE,
  shop: { ...BASE.shop, name: 'Blush Nail Studio' },
  now_calling: [person('c1', '07', 'called', '13:00', 'ศ***', 'ทาสีเจล', 'เตียง 2', '2026-09-10T06:00:00.000Z')],
  next_queue: [
    person('n1', '08', 'waiting', '13:30', 'ณ***', 'ต่อเล็บ', null),
    person('n2', '09', 'waiting', '14:00', 'พ***', 'สปามือ', null),
    person('n3', '10', 'waiting', '14:30', 'ว***', 'ทาสีเจล', null),
  ],
  waiting_queue: [],
  totals: { waiting: 3, calling: 1, served_today: 6 },
};

export const MOCK_SIGNAGE_BUFFET: SignageData = {
  ...BASE,
  shop: { ...BASE.shop, name: 'หมูกระทะ 24 ชม.' },
  now_calling: [
    person('c1', 'T31', 'called', '18:20', 'ศ***', 'โต๊ะ 4 ที่นั่ง', 'โต๊ะ 12', '2026-09-10T11:20:00.000Z'),
    person('c2', 'T30', 'called', '18:15', 'ณ***', 'โต๊ะ 2 ที่นั่ง', 'โต๊ะ 5', '2026-09-10T11:15:00.000Z'),
  ],
  next_queue: [
    person('n1', 'T32', 'waiting', '18:25', 'พ***', 'โต๊ะ 6 ที่นั่ง', null),
    person('n2', 'T33', 'waiting', '18:30', 'ว***', 'โต๊ะ 4 ที่นั่ง', null),
    person('n3', 'T34', 'waiting', '18:35', 'ก***', 'โต๊ะ 2 ที่นั่ง', null),
    person('n4', 'T35', 'waiting', '18:40', 'ธ***', 'โต๊ะ 4 ที่นั่ง', null),
    person('n5', 'T36', 'waiting', '18:45', 'ส***', 'โต๊ะ 8 ที่นั่ง', null),
  ],
  waiting_queue: [
    person('w1', 'T37', 'waiting', '18:50', 'อ***', null, null),
    person('w2', 'T38', 'waiting', '18:55', 'บ***', null, null),
    person('w3', 'T39', 'waiting', '19:00', 'ม***', null, null),
    person('w4', 'T40', 'waiting', '19:05', 'ป***', null, null),
    person('w5', 'T41', 'waiting', '19:10', 'จ***', null, null),
  ],
  totals: { waiting: 10, calling: 2, served_today: 41 },
};

export const MOCK_SIGNAGE_DATA = MOCK_SIGNAGE_RESTAURANT;

/** A showcase preset: template + palette + matching sample data. */
export type SignageShowcasePreset = {
  id: string;
  label_th: string;
  template: SignageTemplate;
  theme: SignageTheme;
  data: SignageData;
};

export const SIGNAGE_SHOWCASE_PRESETS: SignageShowcasePreset[] = [
  { id: 'restaurant', label_th: 'ร้านอาหาร', template: 'spotlight', theme: 'restaurant', data: MOCK_SIGNAGE_RESTAURANT },
  { id: 'clinic', label_th: 'คลินิก', template: 'counter', theme: 'clinic', data: MOCK_SIGNAGE_CLINIC },
  { id: 'barber', label_th: 'ร้านตัดผม', template: 'classic', theme: 'emerald', data: MOCK_SIGNAGE_BARBER },
  { id: 'nail', label_th: 'ร้านเล็บ / บิวตี้', template: 'minimal', theme: 'light', data: MOCK_SIGNAGE_NAIL },
  { id: 'buffet', label_th: 'บุฟเฟ่ต์', template: 'board', theme: 'midnight', data: MOCK_SIGNAGE_BUFFET },
];

/** Build a config for a preset on top of the defaults. */
export function presetConfig(preset: Pick<SignageShowcasePreset, 'template' | 'theme'>, overrides: Partial<SignageConfig> = {}): SignageConfig {
  return { ...DEFAULT_SIGNAGE_CONFIG, template: preset.template, theme: preset.theme, show_qr: true, announcement_text: 'ยินดีต้อนรับ วันนี้มีโปรโมชั่นพิเศษสำหรับสมาชิก LINE', ...overrides };
}
