import { describe, expect, it } from 'vitest';
import { alertKindForChange, driverAlert } from './driver-alerts';

describe('driverAlert', () => {
  it('names the dock and the call number', () => {
    const a = driverAlert('called', 'b1', { queueNo: 'R-005', dock: 'ท่า 3', callCount: 2 });
    expect(a.title).toContain('R-005');
    expect(a.title).toContain('ครั้งที่ 2');
    expect(a.body).toContain('ท่า 3');
    expect(a.tag).toBe('fameline-b1-called');
    expect(a.requireInteraction).toBe(true);
  });

  it('first call has no repeat suffix and falls back to "ท่า" when unassigned', () => {
    const a = driverAlert('called', 'b1', { queueNo: 'R-005', dock: null, callCount: 1 });
    expect(a.title).not.toContain('ครั้งที่');
    expect(a.body).toContain('เข้าท่า');
  });

  it('late tells the driver how long is left only when the site auto-closes', () => {
    const closing = driverAlert('late', 'b1', { queueNo: 'S-002', dock: null, graceMinutes: 30, autoNoShow: true });
    expect(closing.body).toContain('30 นาที');
    const open = driverAlert('late', 'b1', { queueNo: 'S-002', dock: null, graceMinutes: 30, autoNoShow: false });
    expect(open.body).not.toContain('30 นาที');
    expect(open.body).toContain('ยังเข้าได้');
  });

  it('waiting names the busy dock when known', () => {
    expect(driverAlert('waiting', 'b1', { queueNo: 'R-2', dock: 'ท่า 1' }).body).toContain('ท่า 1ยังไม่ว่าง');
    expect(driverAlert('waiting', 'b1', { queueNo: 'R-2', dock: null }).body).toContain('ท่ายังไม่ว่าง');
  });

  it('every kind yields non-empty Thai copy and a per-booking tag', () => {
    for (const kind of ['called', 'waiting', 'late', 'cancelled', 'no_show'] as const) {
      const a = driverAlert(kind, 'xyz', { queueNo: 'R-1', dock: null });
      expect(a.title.length).toBeGreaterThan(3);
      expect(a.body.length).toBeGreaterThan(3);
      expect(a.tag).toBe(`fameline-xyz-${kind}`);
      expect(a.vibrate.length).toBeGreaterThan(0);
    }
  });
});

describe('alertKindForChange', () => {
  it('ignores the first load and unchanged status', () => {
    expect(alertKindForChange(null, { status: 'called', call_count: 1 })).toBeNull();
    expect(alertKindForChange({ status: 'confirmed', call_count: 0 }, { status: 'confirmed', call_count: 0 })).toBeNull();
  });

  it('alerts on call, repeat call, late and closures', () => {
    expect(alertKindForChange({ status: 'checked_in', call_count: 0 }, { status: 'called', call_count: 1 })).toBe('called');
    expect(alertKindForChange({ status: 'called', call_count: 1 }, { status: 'called', call_count: 2 })).toBe('called');
    expect(alertKindForChange({ status: 'called', call_count: 2 }, { status: 'called', call_count: 2 })).toBeNull();
    expect(alertKindForChange({ status: 'confirmed', call_count: 0 }, { status: 'late', call_count: 0 })).toBe('late');
    expect(alertKindForChange({ status: 'late', call_count: 0 }, { status: 'no_show', call_count: 0 })).toBe('no_show');
    expect(alertKindForChange({ status: 'confirmed', call_count: 0 }, { status: 'cancelled', call_count: 0 })).toBe('cancelled');
  });

  it('alerts once when the server stamps "please wait" on a checked-in truck', () => {
    const before = { status: 'checked_in', call_count: 0, wait_notified_at: null };
    const stamped = { status: 'checked_in', call_count: 0, wait_notified_at: '2026-09-24T04:05:00Z' };
    expect(alertKindForChange(before, stamped)).toBe('waiting');
    expect(alertKindForChange(stamped, stamped)).toBeNull();
    // First load of an already-stamped booking stays quiet; a call after the wait still alerts.
    expect(alertKindForChange(null, stamped)).toBeNull();
    expect(alertKindForChange(stamped, { ...stamped, status: 'called', call_count: 1 })).toBe('called');
  });

  it('stays quiet for progress the driver already sees on screen', () => {
    expect(alertKindForChange({ status: 'confirmed', call_count: 0 }, { status: 'checked_in', call_count: 0 })).toBeNull();
    expect(alertKindForChange({ status: 'called', call_count: 1 }, { status: 'serving', call_count: 1 })).toBeNull();
    expect(alertKindForChange({ status: 'serving', call_count: 1 }, { status: 'completed', call_count: 1 })).toBeNull();
  });
});
