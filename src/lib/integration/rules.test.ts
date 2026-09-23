import { describe, expect, it } from 'vitest';
import { decidePaymentWrite, resolveBranch } from './rules';

describe('resolveBranch', () => {
  const branches = [
    { id: 'a', code: 'WH1', branch_name: 'คลังบางนา' },
    { id: 'b', code: null, branch_name: 'คลังระยอง' },
  ];
  it('matches code case-insensitively, then name', () => {
    expect(resolveBranch(branches, 'wh1')?.id).toBe('a');
    expect(resolveBranch(branches, ' คลังระยอง ')?.id).toBe('b');
    expect(resolveBranch(branches, 'WH9')).toBeNull();
    expect(resolveBranch(branches, '')).toBeNull();
  });
});

describe('decidePaymentWrite', () => {
  it('leaves the stored value alone when nothing is sent', () => {
    expect(decidePaymentWrite({ source: 'api', incoming: undefined, existing: 'paid', hasConfirmedBookings: false })).toBe('none');
  });

  it('lets any source clear an unpaid SO', () => {
    expect(decidePaymentWrite({ source: 'api', incoming: 'credit', existing: 'unpaid', hasConfirmedBookings: true })).toBe('write');
    expect(decidePaymentWrite({ source: 'csv', incoming: 'paid', existing: null, hasConfirmedBookings: false })).toBe('write');
    expect(decidePaymentWrite({ source: 'api', incoming: 'credit', existing: 'paid', hasConfirmedBookings: true })).toBe('write');
  });

  it('never lets the ERP take a cleared SO back to unpaid', () => {
    expect(decidePaymentWrite({ source: 'api', incoming: 'unpaid', existing: 'paid', hasConfirmedBookings: false })).toBe('skip_downgrade');
    expect(decidePaymentWrite({ source: 'api', incoming: 'unpaid', existing: 'credit', hasConfirmedBookings: true })).toBe('skip_downgrade');
  });

  it('lets CSV / manual downgrade only while no queue is approved', () => {
    expect(decidePaymentWrite({ source: 'csv', incoming: 'unpaid', existing: 'paid', hasConfirmedBookings: false })).toBe('write');
    expect(decidePaymentWrite({ source: 'manual', incoming: 'unpaid', existing: 'paid', hasConfirmedBookings: true })).toBe('skip_downgrade');
  });

  it('treats unpaid → unpaid as a plain write', () => {
    expect(decidePaymentWrite({ source: 'api', incoming: 'unpaid', existing: 'unpaid', hasConfirmedBookings: true })).toBe('write');
  });
});
