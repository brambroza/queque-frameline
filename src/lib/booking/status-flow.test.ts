import { describe, expect, it } from 'vitest';
import {
  checkInDenialMessage,
  checkInEligibility,
  isApprovalTransition,
  isCallTransition,
  resolveInitialBookingStatus,
} from './status-flow';

describe('resolveInitialBookingStatus', () => {
  it('confirms by default', () => {
    expect(resolveInitialBookingStatus(null)).toBe('confirmed');
    expect(resolveInitialBookingStatus({})).toBe('confirmed');
    expect(resolveInitialBookingStatus({ requires_approval: false, booking_mode: 'fixed_slot' })).toBe('confirmed');
  });

  it('holds for approval when the service asks for it', () => {
    expect(resolveInitialBookingStatus({ requires_approval: true })).toBe('pending_approval');
    expect(resolveInitialBookingStatus({ booking_mode: 'request_approval' })).toBe('pending_approval');
    expect(resolveInitialBookingStatus({ requires_approval: false, booking_mode: 'request_approval' })).toBe('pending_approval');
  });
});

describe('checkInEligibility', () => {
  const today = '2026-09-13';

  it('allows a confirmed booking on its day', () => {
    expect(checkInEligibility({ status: 'confirmed', booking_date: today }, today)).toEqual({ ok: true });
    expect(checkInEligibility({ status: 'pending', booking_date: today }, today)).toEqual({ ok: true });
  });

  it('refuses another day', () => {
    expect(checkInEligibility({ status: 'confirmed', booking_date: '2026-09-14' }, today)).toEqual({ ok: false, reason: 'not_today' });
  });

  it('refuses once called, served, cancelled or awaiting approval', () => {
    for (const status of ['pending_approval', 'waiting', 'called', 'serving', 'completed', 'cancelled', 'no_show']) {
      expect(checkInEligibility({ status, booking_date: today }, today)).toEqual({ ok: false, reason: 'wrong_status' });
    }
  });

  it('reports a second tap as already checked in', () => {
    expect(checkInEligibility({ status: 'checked_in', booking_date: today }, today)).toEqual({ ok: false, reason: 'already_checked_in' });
  });

  it('has a Thai message for every reason', () => {
    expect(checkInDenialMessage('already_checked_in')).toContain('แล้ว');
    expect(checkInDenialMessage('not_today')).toContain('วันที่จอง');
    expect(checkInDenialMessage('wrong_status')).toContain('ไม่สามารถ');
  });
});

describe('transitions', () => {
  it('detects a call from every waiting-ish status and re-calls', () => {
    expect(isCallTransition('confirmed', 'called')).toBe(true);
    expect(isCallTransition('checked_in', 'called')).toBe(true);
    expect(isCallTransition('waiting', 'called')).toBe(true);
    expect(isCallTransition('called', 'called')).toBe(true);
    expect(isCallTransition('serving', 'called')).toBe(false);
    expect(isCallTransition('waiting', 'serving')).toBe(false);
  });

  it('detects approval only from pending_approval', () => {
    expect(isApprovalTransition('pending_approval', 'confirmed')).toBe(true);
    expect(isApprovalTransition('pending', 'confirmed')).toBe(false);
    expect(isApprovalTransition('pending_approval', 'cancelled')).toBe(false);
  });
});
