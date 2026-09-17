/**
 * Design tokens — แกนกลางของทั้งระบบ (MUI + Tailwind ใช้ร่วมกัน)
 *
 * แก้สี/เงา/รัศมี ที่ไฟล์นี้ที่เดียว จะมีผลทั้ง portal, landing และ liff
 * โทน: เขียว LINE-ish ปรับให้พรีเมียม (deep emerald) รองรับ light + dark
 */

/** Brand green scale — พรีเมียม emerald ที่เข้ากับ LINE ecosystem */
export const brand = {
  50: '#e9fbf1',
  100: '#c9f4dd',
  200: '#97e8bf',
  300: '#5dd79c',
  400: '#2ec37c',
  500: '#12a862', // primary หลัก (light)
  600: '#0b8d51',
  700: '#0a7043',
  800: '#0b5937',
  900: '#0a482e',
} as const;

/** Neutral (slate) scale — ใช้กับพื้นหลัง เส้น และข้อความ */
export const neutral = {
  0: '#ffffff',
  25: '#fcfcfd',
  50: '#f7f8fa',
  100: '#eef1f5',
  200: '#e3e8ef',
  300: '#cdd5df',
  400: '#9aa4b2',
  500: '#697586',
  600: '#4b5565',
  700: '#364152',
  800: '#202939',
  900: '#121926',
  950: '#0b0f16',
} as const;

/** Semantic status colors — ใช้กับ chip/alert/สถานะคิว */
export const status = {
  success: '#12a862',
  warning: '#dd8f0a',
  error: '#e14b4a',
  info: '#2e8ad8',
} as const;

/** LINE brand green (ใช้เฉพาะจุดที่สื่อถึง LINE โดยตรง) */
export const lineGreen = '#06C755';

/** รัศมีมุม */
export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
} as const;

/** Elevation / shadow — โทนนุ่ม เลเยอร์คู่ ให้ดูพรีเมียม */
export const shadowLight = {
  xs: '0 1px 2px rgba(16,24,40,0.05)',
  sm: '0 1px 3px rgba(16,24,40,0.08), 0 1px 2px rgba(16,24,40,0.04)',
  md: '0 4px 12px rgba(16,24,40,0.08), 0 2px 4px rgba(16,24,40,0.04)',
  lg: '0 12px 28px rgba(16,24,40,0.10), 0 4px 8px rgba(16,24,40,0.05)',
  xl: '0 24px 48px rgba(16,24,40,0.14)',
  brand: '0 8px 24px rgba(18,168,98,0.28)',
} as const;

export const shadowDark = {
  xs: '0 1px 2px rgba(0,0,0,0.4)',
  sm: '0 1px 3px rgba(0,0,0,0.5), 0 1px 2px rgba(0,0,0,0.3)',
  md: '0 4px 12px rgba(0,0,0,0.5), 0 2px 4px rgba(0,0,0,0.35)',
  lg: '0 12px 28px rgba(0,0,0,0.6), 0 4px 8px rgba(0,0,0,0.4)',
  xl: '0 24px 48px rgba(0,0,0,0.7)',
  brand: '0 8px 24px rgba(18,168,98,0.4)',
} as const;

/** Semantic surface tokens สำหรับแต่ละโหมด (ให้ตรงกับ CSS variables ใน globals.css) */
export const lightSurface = {
  bg: neutral[50],
  paper: neutral[0],
  paperMuted: neutral[25],
  text: neutral[900],
  textSecondary: neutral[500],
  divider: neutral[200],
  hover: 'rgba(18,168,98,0.06)',
  selected: 'rgba(18,168,98,0.12)',
} as const;

export const darkSurface = {
  bg: '#0b0f16',
  paper: '#141a24',
  paperMuted: '#0f151d',
  text: '#e6edf5',
  textSecondary: '#94a1b2',
  divider: 'rgba(255,255,255,0.08)',
  hover: 'rgba(46,195,124,0.10)',
  selected: 'rgba(46,195,124,0.16)',
} as const;

export type ColorMode = 'light' | 'dark';
