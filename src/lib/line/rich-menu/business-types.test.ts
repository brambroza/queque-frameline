import { describe, expect, it } from 'vitest';
import { BUSINESS_TYPE_LABELS, BUSINESS_TYPES, normalizeBusinessType } from './business-types';

/** Must stay in sync with BUSINESS_CATEGORIES in src/components/auth/register-form.tsx */
const REGISTRATION_VALUES = [
  'ร้านตัดผม', 'ร้านทำเล็บ', 'คลินิก', 'ร้านอาหาร', 'buffet', 'fitness', 'meeting_room',
  'ร้านซ่อมรถ', 'ร้านซ่อมมือถือ', 'ทีมช่างติดตั้ง', 'งานราชการ', 'Consult',
];

describe('normalizeBusinessType', () => {
  it.each(REGISTRATION_VALUES)('maps registration value %s', (raw) => {
    expect(normalizeBusinessType(raw)).not.toBeNull();
  });

  it('maps demo business types', () => {
    expect(normalizeBusinessType('barber')).toBe('salon');
    expect(normalizeBusinessType('clinic')).toBe('clinic');
    expect(normalizeBusinessType('meeting_room')).toBe('meeting_room');
    expect(normalizeBusinessType('general_service')).toBeNull();
  });

  it('accepts already-normalized keys and trims / lowercases', () => {
    for (const key of BUSINESS_TYPES) expect(normalizeBusinessType(key)).toBe(key);
    expect(normalizeBusinessType('  Fitness ')).toBe('fitness');
  });

  it('returns null for empty or unknown', () => {
    expect(normalizeBusinessType(null)).toBeNull();
    expect(normalizeBusinessType('')).toBeNull();
    expect(normalizeBusinessType('spa')).toBeNull();
  });

  it('has a Thai label for every type', () => {
    for (const key of BUSINESS_TYPES) expect(BUSINESS_TYPE_LABELS[key]).toBeTruthy();
  });
});
