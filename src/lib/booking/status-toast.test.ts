import { describe, expect, it } from 'vitest';
import { kindForStatusChange, statusSuccessMessage } from './status-toast';

describe('statusSuccessMessage', () => {
  it('approval names the DO and walk-in check-in when present', () => {
    expect(statusSuccessMessage({ kind: 'confirm', queueNumber: 'R-001', doNumber: 'DO-202610-0001', checkedIn: true }))
      .toBe('อนุมัติคิว R-001 แล้ว · DO-202610-0001 · เช็คอิน Walk-in แล้ว');
  });
  it('approval without a DO still says something', () => {
    expect(statusSuccessMessage({ kind: 'confirm', queueNumber: 'R-001' })).toBe('อนุมัติคิว R-001 แล้ว');
  });
  it('call names the dock, or falls back to a generic dock', () => {
    expect(statusSuccessMessage({ kind: 'call', queueNumber: 'S-002', resourceName: 'A' })).toBe('เรียก S-002 เข้าท่า Aแล้ว');
    expect(statusSuccessMessage({ kind: 'recall', queueNumber: 'S-002', resourceName: null })).toBe('เรียก S-002 เข้าท่าแล้ว');
  });
  it('covers every kind without a bare "สำเร็จ"', () => {
    const kinds = ['arrive', 'uncall', 'serve', 'done', 'no_show', 'cancel', 'other'] as const;
    for (const kind of kinds) {
      const m = statusSuccessMessage({ kind, queueNumber: 'R-009' });
      expect(m).toContain('R-009');
      expect(m).toContain('แล้ว');
      expect(m).not.toContain('สำเร็จ');
    }
    expect(statusSuccessMessage({ kind: 'done', queueNumber: 'R-009', signed: true })).toContain('ลายเซ็น');
  });
  it('uses a placeholder when the queue number is empty', () => {
    expect(statusSuccessMessage({ kind: 'cancel', queueNumber: '' })).toBe('ยกเลิกคิว คิว แล้ว');
  });
});

describe('kindForStatusChange', () => {
  it('tells arrive from uncall and call from recall by the previous status', () => {
    expect(kindForStatusChange('confirmed', 'checked_in')).toBe('arrive');
    expect(kindForStatusChange('late', 'checked_in')).toBe('arrive');
    expect(kindForStatusChange('called', 'checked_in')).toBe('uncall');
    expect(kindForStatusChange('checked_in', 'called')).toBe('call');
    expect(kindForStatusChange('called', 'called')).toBe('recall');
  });
  it('maps the rest directly', () => {
    expect(kindForStatusChange('pending', 'confirmed')).toBe('confirm');
    expect(kindForStatusChange('called', 'serving')).toBe('serve');
    expect(kindForStatusChange('serving', 'completed')).toBe('done');
    expect(kindForStatusChange('called', 'no_show')).toBe('no_show');
    expect(kindForStatusChange('pending', 'cancelled')).toBe('cancel');
    expect(kindForStatusChange('pending', 'late')).toBe('other');
  });
});
