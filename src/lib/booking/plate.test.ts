import { describe, expect, it } from 'vitest';
import { effectivePlate, formatPlateInput, hasPlateMismatch, isPlausiblePlate, matchesPlateFormat, normalizePlate, platesMatch, toPlateFormat } from './plate';

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

describe('matchesPlateFormat', () => {
  it('accepts car plates only for car types', () => {
    expect(matchesPlateFormat('กข 1234', 'car')).toBe(true);
    expect(matchesPlateFormat('1กข-1234', 'car')).toBe(true);
    expect(matchesPlateFormat('ก 99', 'car')).toBe(true);
    expect(matchesPlateFormat('3ฒฮ 999 กทม.', 'car')).toBe(true);
    expect(matchesPlateFormat('70-1234', 'car')).toBe(false);
    expect(matchesPlateFormat('กขค 1234', 'car')).toBe(false);
    expect(matchesPlateFormat('กข 12345', 'car')).toBe(false);
    expect(matchesPlateFormat('AB 1234', 'car')).toBe(false);
    expect(matchesPlateFormat('กข', 'car')).toBe(false);
  });
  it('accepts truck plates only for truck types', () => {
    expect(matchesPlateFormat('70-1234', 'truck')).toBe(true);
    expect(matchesPlateFormat('701234', 'truck')).toBe(true);
    expect(matchesPlateFormat('700-1234', 'truck')).toBe(true);
    expect(matchesPlateFormat('70-1234 ชลบุรี', 'truck')).toBe(true);
    expect(matchesPlateFormat('๗๐-๑๒๓๔', 'truck')).toBe(true);
    expect(matchesPlateFormat('70-123', 'truck')).toBe(false);
    expect(matchesPlateFormat('07-1234', 'truck')).toBe(false);
    expect(matchesPlateFormat('กข 1234', 'truck')).toBe(false);
  });
  it('accepts either layout for any, but nothing else', () => {
    expect(matchesPlateFormat('กข 1234', 'any')).toBe(true);
    expect(matchesPlateFormat('70-1234', 'any')).toBe(true);
    expect(matchesPlateFormat('1234', 'any')).toBe(false);
    expect(matchesPlateFormat('', 'any')).toBe(false);
    expect(matchesPlateFormat(null, 'any')).toBe(false);
  });
});

describe('formatPlateInput', () => {
  it('masks truck plates as digits with a dash', () => {
    expect(formatPlateInput('7', 'truck')).toBe('7');
    expect(formatPlateInput('701', 'truck')).toBe('70-1');
    expect(formatPlateInput('701234', 'truck')).toBe('70-1234');
    expect(formatPlateInput('7001234', 'truck')).toBe('700-1234');
    expect(formatPlateInput('70012345', 'truck')).toBe('700-1234');
    expect(formatPlateInput('กข70-12 34', 'truck')).toBe('70-1234');
  });
  it('masks car plates as letters, a space, then digits', () => {
    expect(formatPlateInput('กข', 'car')).toBe('กข');
    expect(formatPlateInput('กข1234', 'car')).toBe('กข 1234');
    expect(formatPlateInput('1กข12345', 'car')).toBe('1กข 1234');
    expect(formatPlateInput('กขค1234', 'car')).toBe('กข 1234');
    expect(formatPlateInput('ab-กข.12', 'car')).toBe('กข 12');
    expect(formatPlateInput('70-1234', 'car')).toBe('7');
  });
  it('picks the layout from what is typed for any', () => {
    expect(formatPlateInput('1', 'any')).toBe('1');
    expect(formatPlateInput('1กข1234', 'any')).toBe('1กข 1234');
    expect(formatPlateInput('701234', 'any')).toBe('70-1234');
  });
  it('always yields a value its own format accepts once complete', () => {
    expect(matchesPlateFormat(formatPlateInput('701234', 'truck'), 'truck')).toBe(true);
    expect(matchesPlateFormat(formatPlateInput('2ฒค5678', 'car'), 'car')).toBe(true);
  });
});

describe('toPlateFormat', () => {
  it('falls back to any', () => {
    expect(toPlateFormat('truck')).toBe('truck');
    expect(toPlateFormat(undefined)).toBe('any');
    expect(toPlateFormat('bike')).toBe('any');
  });
});
