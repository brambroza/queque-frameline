import { describe, expect, it } from 'vitest';
import { describeVehicleChange, diffVehicleChange, driverLabel } from './vehicle-change';

const before = { plate_number: '701234', plate_number_actual: null, driver_name: 'สมชาย', driver_phone: '0812345678' };

describe('diffVehicleChange', () => {
  it('reports nothing when the plate is only retyped with separators', () => {
    const d = diffVehicleChange(before, { plate_number: '70-1234', driver_name: ' สมชาย ', driver_phone: '0812345678' });
    expect(d.plate).toBeNull();
    expect(d.driver).toBeNull();
    expect(d.update).toEqual({});
  });

  it('replaces the booked plate (normalised) and keeps the driver', () => {
    const d = diffVehicleChange(before, { plate_number: '71-5555', driver_name: 'สมชาย', driver_phone: '0812345678' });
    expect(d.plate).toEqual({ from: '701234', to: '715555' });
    expect(d.driver).toBeNull();
    expect(d.update).toEqual({ plate_number: '715555' });
  });

  it('changes the driver only, blank phone becomes null', () => {
    const d = diffVehicleChange(before, { plate_number: '701234', driver_name: 'สมหญิง', driver_phone: '' });
    expect(d.plate).toBeNull();
    expect(d.driver).toEqual({ from: 'สมชาย · 0812345678', to: 'สมหญิง' });
    expect(d.update).toEqual({ driver_name: 'สมหญิง', driver_phone: null });
  });

  it('clears a gate correction that now matches the new booked plate', () => {
    const d = diffVehicleChange({ ...before, plate_number_actual: '715555' }, { plate_number: '71-5555', driver_name: before.driver_name, driver_phone: before.driver_phone });
    expect(d.update).toEqual({ plate_number: '715555', plate_number_actual: null });
  });

  it('keeps a gate correction that still differs from the new plate', () => {
    const d = diffVehicleChange({ ...before, plate_number_actual: '999999' }, { plate_number: '71-5555', driver_name: before.driver_name, driver_phone: before.driver_phone });
    expect(d.update).toEqual({ plate_number: '715555' });
  });

  it('treats an omitted driver as "no driver" (form always sends both fields)', () => {
    const d = diffVehicleChange(before, { plate_number: '701234' });
    expect(d.driver).toEqual({ from: 'สมชาย · 0812345678', to: '-' });
    expect(d.update).toEqual({ driver_name: null, driver_phone: null });
  });

  it('shows "-" for a queue that had no driver', () => {
    const d = diffVehicleChange({ ...before, driver_name: null, driver_phone: null }, { plate_number: '701234', driver_name: 'ก้อง' });
    expect(d.driver).toEqual({ from: '-', to: 'ก้อง' });
    expect(driverLabel(null, undefined)).toBe('-');
  });
});

describe('describeVehicleChange', () => {
  it('lists both parts when both changed', () => {
    const d = diffVehicleChange(before, { plate_number: '71-5555', driver_name: 'สมหญิง', driver_phone: '0899999999' });
    expect(describeVehicleChange('R-007', d)).toBe('R-007: ลูกค้าเปลี่ยน ทะเบียน 701234 → 715555, คนขับ สมชาย · 0812345678 → สมหญิง · 0899999999 (ผ่านลิงก์)');
  });
});
