import { describe, expect, it } from 'vitest';
import { MAX_WAITING_TRUCKS, TRUCK_BODY_LENGTH, directionLabel, sceneLayout, truckKind } from './yard';

const truck = (id: string, status = 'checked_in', service_name: string | null = 'รถ 6 ล้อ') => ({
  id, queue_number: `R-00${id}`, plate: `70-000${id}`, status, service_name, start_time: '14:30:00',
});

describe('truckKind', () => {
  it('maps Thai vehicle-type names', () => {
    expect(truckKind('รถ 4 ล้อ')).toBe('four');
    expect(truckKind('รถกระบะ')).toBe('four');
    expect(truckKind('รถ 6 ล้อ')).toBe('six');
    expect(truckKind('รถ 10 ล้อ')).toBe('ten');
    expect(truckKind('รถสิบล้อ')).toBe('ten');
    expect(truckKind('เทรลเลอร์')).toBe('trailer');
    expect(truckKind('รถพ่วง 18 ล้อ')).toBe('trailer');
  });
  it('maps English names and falls back to six', () => {
    expect(truckKind('10 Wheel Truck')).toBe('ten');
    expect(truckKind('Trailer')).toBe('trailer');
    expect(truckKind(null)).toBe('six');
    expect(truckKind('รถอะไรก็ได้')).toBe('six');
  });
  it('orders body lengths trailer > ten > six > four', () => {
    expect(TRUCK_BODY_LENGTH.trailer).toBeGreaterThan(TRUCK_BODY_LENGTH.ten);
    expect(TRUCK_BODY_LENGTH.ten).toBeGreaterThan(TRUCK_BODY_LENGTH.six);
    expect(TRUCK_BODY_LENGTH.six).toBeGreaterThan(TRUCK_BODY_LENGTH.four);
  });
});

describe('directionLabel', () => {
  it('labels both directions and the shared dock', () => {
    expect(directionLabel('outbound')).toBe('รับสินค้า');
    expect(directionLabel('inbound')).toBe('ส่งสินค้า');
    expect(directionLabel(null)).toBe('รับ / ส่ง');
  });
});

describe('sceneLayout', () => {
  it('spreads docks evenly and keeps feed order', () => {
    const out = sceneLayout(
      [
        { id: 'a', name: 'ท่า 1', direction: 'outbound', current: null },
        { id: 'b', name: 'ท่า 2', direction: 'inbound', current: null },
      ],
      [],
      1000,
    );
    expect(out.docks.map((d) => d.x)).toEqual([0, 500]);
    expect(out.docks.every((d) => d.width === 500)).toBe(true);
    expect(out.docks[0].state).toBe('idle');
    expect(out.docks[0].truck).toBeNull();
    expect(out.docks[1].direction).toBe('ส่งสินค้า');
  });

  it('marks a called truck as calling and a serving truck as serving', () => {
    const out = sceneLayout(
      [
        { id: 'a', name: 'ท่า 1', direction: 'outbound', current: truck('1', 'called', 'รถ 10 ล้อ') },
        { id: 'b', name: 'ท่า 2', direction: null, current: truck('2', 'serving') },
      ],
      [],
    );
    expect(out.docks[0].state).toBe('calling');
    expect(out.docks[0].truck).toMatchObject({ queue: 'R-001', plate: '70-0001', kind: 'ten', time: '14:30', calling: true });
    expect(out.docks[1].state).toBe('serving');
    expect(out.docks[1].truck?.calling).toBe(false);
  });

  it('caps the waiting lane and reports the overflow', () => {
    const waiting = Array.from({ length: MAX_WAITING_TRUCKS + 3 }, (_, i) => truck(String(i + 1)));
    const out = sceneLayout([], waiting);
    expect(out.waiting).toHaveLength(MAX_WAITING_TRUCKS);
    expect(out.waiting[0].queue).toBe('R-001');
    expect(out.overflow).toBe(3);
  });

  it('reports no overflow when everything fits and shows "-" for a missing plate', () => {
    const out = sceneLayout([], [{ ...truck('1'), plate: '' }]);
    expect(out.overflow).toBe(0);
    expect(out.waiting[0].plate).toBe('-');
  });

  it('still returns one full-width slot when there are no docks', () => {
    expect(sceneLayout([], []).docks).toEqual([]);
  });
});
