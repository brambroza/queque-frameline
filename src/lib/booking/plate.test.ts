import { describe, expect, it } from 'vitest';
import { effectivePlate, hasPlateMismatch, isPlausiblePlate, normalizePlate, platesMatch } from './plate';

describe('normalizePlate', () => {
  it('strips separators and upper-cases', () => {
    expect(normalizePlate(' กข 1234 ')).toBe('กข1234');
    expect(normalizePlate('1กข-1234')).toBe('1กข1234');
    expect(normalizePlate('70-1234')).toBe('701234');
    expect(normalizePlate('ab.1234')).toBe('AB1234');
  });
  it('drops a trailing province', () => {
    expect(normalizePlate('กข 1234 กรุงเทพมหานคร')).toBe('กข1234');
    expect(normalizePlate('70-1234 ชลบุรี')).toBe('701234');
    expect(normalizePlate('3ฒฮ 999 กทม.')).toBe('3ฒฮ999');
  });
  it('handles blanks', () => {
    expect(normalizePlate(null)).toBe('');
    expect(normalizePlate('   ')).toBe('');
  });
});

describe('isPlausiblePlate', () => {
  it('needs a digit and sane length', () => {
    expect(isPlausiblePlate('กข 1234')).toBe(true);
    expect(isPlausiblePlate('กขค')).toBe(false);
    expect(isPlausiblePlate('1')).toBe(false);
    expect(isPlausiblePlate('')).toBe(false);
  });
});

describe('matching', () => {
  it('matches across formatting', () => {
    expect(platesMatch('กข 1234', 'กข-1234 กรุงเทพมหานคร')).toBe(true);
    expect(platesMatch('กข 1234', 'กข 1235')).toBe(false);
    expect(platesMatch('', '')).toBe(false);
  });
  it('flags a mismatch only when the gate recorded one', () => {
    expect(hasPlateMismatch({ plate_number: 'กข1234', plate_number_actual: null })).toBe(false);
    expect(hasPlateMismatch({ plate_number: 'กข1234', plate_number_actual: 'กข 1234' })).toBe(false);
    expect(hasPlateMismatch({ plate_number: 'กข1234', plate_number_actual: 'กข1235' })).toBe(true);
  });
  it('prefers the plate seen at the gate', () => {
    expect(effectivePlate({ plate_number: 'A1', plate_number_actual: 'B2' })).toBe('B2');
    expect(effectivePlate({ plate_number: 'A1' })).toBe('A1');
  });
});
