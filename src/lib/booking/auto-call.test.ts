import { describe, expect, it } from 'vitest';
import { pickNextToCall, type CallCandidate, type DockState } from './auto-call';

const dock = (id: string, o: Partial<DockState> = {}): DockState => ({ id, direction: null, service_ids: null, busy: false, ...o });
const cand = (id: string, o: Partial<CallCandidate> = {}): CallCandidate => ({
  id, resource_id: 'D1', service_id: 'v10', direction: 'outbound', booking_date: '2026-09-21', start_time: '09:00:00', checked_in_at: '2026-09-21T01:50:00Z', ...o,
});
const now = new Date('2026-09-21T02:00:00Z'); // 09:00 Bangkok
const dockFree = { auto_call_mode: 'dock_free' as const, auto_call_lead_minutes: 0 };

describe('pickNextToCall', () => {
  it('does nothing when off or no dock is free', () => {
    expect(pickNextToCall([dock('D1')], [cand('a')], now, { ...dockFree, auto_call_mode: 'off' })).toEqual([]);
    expect(pickNextToCall([dock('D1', { busy: true })], [cand('a')], now, dockFree)).toEqual([]);
  });

  it('calls the earliest appointment on a free dock, arrival breaks ties', () => {
    const picks = pickNextToCall(
      [dock('D1')],
      [cand('late-slot', { start_time: '10:00' }), cand('b', { checked_in_at: '2026-09-21T01:55:00Z' }), cand('a', { checked_in_at: '2026-09-21T01:40:00Z' })],
      now, dockFree,
    );
    expect(picks).toEqual([{ bookingId: 'a', dockId: 'D1', assignDock: false }]);
  });

  it('never sends a vehicle to a dock it was not booked on', () => {
    expect(pickNextToCall([dock('D2')], [cand('a', { resource_id: 'D1' })], now, dockFree)).toEqual([]);
  });

  it('gives dock-less vehicles a dock that fits direction and vehicle type', () => {
    const docks = [dock('IN', { direction: 'inbound' }), dock('SMALL', { service_ids: ['v4'] }), dock('ANY')];
    const picks = pickNextToCall(docks, [cand('a', { resource_id: null })], now, dockFree);
    expect(picks).toEqual([{ bookingId: 'a', dockId: 'ANY', assignDock: true }]);
  });

  it('fills several free docks without calling anyone twice', () => {
    const picks = pickNextToCall(
      [dock('D1'), dock('D2')],
      [cand('a', { resource_id: null }), cand('b', { resource_id: null, start_time: '09:30' })],
      now, dockFree,
    );
    expect(picks.map((p) => `${p.bookingId}@${p.dockId}`)).toEqual(['a@D1', 'b@D2']);
  });

  it('restricts the event path to the released dock', () => {
    const picks = pickNextToCall([dock('D1'), dock('D2')], [cand('a'), cand('b', { resource_id: 'D2' })], now, dockFree, 'D2');
    expect(picks).toEqual([{ bookingId: 'b', dockId: 'D2', assignDock: false }]);
  });

  it('time mode waits for start − lead; dock_free does not', () => {
    const early = cand('a', { start_time: '09:30' });
    expect(pickNextToCall([dock('D1')], [early], now, { auto_call_mode: 'time', auto_call_lead_minutes: 15 })).toEqual([]);
    expect(pickNextToCall([dock('D1')], [early], now, { auto_call_mode: 'time', auto_call_lead_minutes: 30 })).toHaveLength(1);
    expect(pickNextToCall([dock('D1')], [early], now, dockFree)).toHaveLength(1);
  });
});
