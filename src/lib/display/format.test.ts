import { describe, expect, it } from 'vitest';
import { displayPlate, docLabel, hhmm } from './format';

describe('displayPlate', () => {
  it('lays out a truck plate with the dash', () => {
    expect(displayPlate({ plate_number: '701234' }, 'truck')).toBe('70-1234');
    expect(displayPlate({ plate_number: '70-1234 ชลบุรี' }, 'truck')).toBe('70-1234');
  });
  it('lays out a car plate with the space', () => {
    expect(displayPlate({ plate_number: '1กข1234' }, 'car')).toBe('1กข 1234');
    expect(displayPlate({ plate_number: 'กข 1234' }, 'car')).toBe('กข 1234');
  });
  it('picks the layout from the plate when the type accepts any', () => {
    expect(displayPlate({ plate_number: '811234' }, 'any')).toBe('81-1234');
    expect(displayPlate({ plate_number: '2ขค7788' }, 'any')).toBe('2ขค 7788');
    expect(displayPlate({ plate_number: '2ขค7788' }, undefined)).toBe('2ขค 7788');
  });
  it('prefers the plate recorded at the gate', () => {
    expect(displayPlate({ plate_number: '701234', plate_number_actual: '705566' }, 'truck')).toBe('70-5566');
  });
  it('shows a plate that does not fit the layout as recorded', () => {
    expect(displayPlate({ plate_number: 'AB-1234' }, 'car')).toBe('AB-1234');
    expect(displayPlate({ plate_number: 'กข 1234' }, 'truck')).toBe('กข 1234');
  });
  it('returns empty for a missing plate', () => {
    expect(displayPlate({}, 'car')).toBe('');
    expect(displayPlate({ plate_number: '  ' }, 'any')).toBe('');
  });
});

describe('docLabel', () => {
  it('prefixes the document type', () => {
    expect(docLabel('so', '2609-00123')).toBe('SO 2609-00123');
    expect(docLabel('po', '2609-00077')).toBe('PO 2609-00077');
  });
  it('does not double a prefix the number already carries', () => {
    expect(docLabel('so', 'SO-2609-00123')).toBe('SO-2609-00123');
    expect(docLabel('po', 'po2609')).toBe('po2609');
  });
  it('is empty without a number', () => {
    expect(docLabel('so', null)).toBe('');
    expect(docLabel(null, '')).toBe('');
    expect(docLabel(null, 'X-1')).toBe('X-1');
  });
});

describe('hhmm', () => {
  it('trims seconds', () => {
    expect(hhmm('09:30:00')).toBe('09:30');
    expect(hhmm(null)).toBe('');
  });
});
