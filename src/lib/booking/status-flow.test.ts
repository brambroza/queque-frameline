import { describe, expect, it } from 'vitest';
import {
  ALLOWED_TRANSITIONS,
  canTransition,
  freesDock,
  isArrivalTransition,
  isCallTransition,
  isConfirmTransition,
  isTerminalStatus,
  resolveInitialBookingStatus,
  transitionStamps,
} from './status-flow';

describe('resolveInitialBookingStatus', () => {
  it('confirms admin-created queues at once', () => {
    expect(resolveInitialBookingStatus({ source: 'admin', requireAdminConfirm: true })).toBe('confirmed');
  });
  it('holds link bookings for the admin unless the site turned that off', () => {
    expect(resolveInitialBookingStatus({ source: 'customer_link', requireAdminConfirm: true })).toBe('pending');
    expect(resolveInitialBookingStatus({ source: 'customer_link', requireAdminConfirm: false })).toBe('confirmed');
    expect(resolveInitialBookingStatus({ source: 'api', requireAdminConfirm: true })).toBe('pending');
    // Unpaid SO: never starts confirmed, not even for an admin or with confirmation turned off.
    expect(resolveInitialBookingStatus({ source: 'admin', requireAdminConfirm: true, paymentCleared: false })).toBe('pending');
    expect(resolveInitialBookingStatus({ source: 'customer_link', requireAdminConfirm: false, paymentCleared: false })).toBe('pending');
    expect(resolveInitialBookingStatus({ source: 'admin', requireAdminConfirm: true, paymentCleared: true })).toBe('confirmed');
  });
});

describe('canTransition', () => {
  it('follows the happy path for staff, except confirm', () => {
    expect(canTransition('pending', 'confirmed', 'admin')).toEqual({ ok: true });
    expect(canTransition('pending', 'confirmed', 'staff')).toEqual({ ok: true });
    expect(canTransition('confirmed', 'checked_in', 'staff')).toEqual({ ok: true });
    expect(canTransition('checked_in', 'called', 'staff')).toEqual({ ok: true });
    expect(canTransition('called', 'serving', 'staff')).toEqual({ ok: true });
    expect(canTransition('serving', 'completed', 'staff')).toEqual({ ok: true });
  });

  it('refuses skipping steps and leaving terminal states', () => {
    expect(canTransition('confirmed', 'called', 'admin')).toEqual({ ok: false, reason: 'not_allowed' });
    expect(canTransition('pending', 'checked_in', 'admin')).toEqual({ ok: false, reason: 'not_allowed' });
    expect(canTransition('serving', 'cancelled', 'admin')).toEqual({ ok: false, reason: 'not_allowed' });
    for (const s of ['completed', 'cancelled', 'no_show'] as const) {
      expect(ALLOWED_TRANSITIONS[s]).toEqual([]);
      expect(isTerminalStatus(s)).toBe(true);
    }
  });

  it('rejects statuses inherited from Queue', () => {
    expect(canTransition('waiting', 'called', 'admin')).toEqual({ ok: false, reason: 'unknown_status' });
    expect(canTransition('confirmed', 'pending_approval', 'admin')).toEqual({ ok: false, reason: 'unknown_status' });
  });

  it('lets a customer cancel only before arrival', () => {
    expect(canTransition('pending', 'cancelled', 'customer')).toEqual({ ok: true });
    expect(canTransition('late', 'cancelled', 'customer')).toEqual({ ok: true });
    expect(canTransition('checked_in', 'cancelled', 'customer')).toEqual({ ok: false, reason: 'not_customer_cancellable' });
    expect(canTransition('confirmed', 'checked_in', 'customer')).toEqual({ ok: false, reason: 'not_customer_cancellable' });
  });

  it('limits the system to sweep + auto-call moves', () => {
    expect(canTransition('confirmed', 'late', 'system')).toEqual({ ok: true });
    expect(canTransition('late', 'no_show', 'system')).toEqual({ ok: true });
    expect(canTransition('called', 'no_show', 'system')).toEqual({ ok: true });
    expect(canTransition('checked_in', 'called', 'system')).toEqual({ ok: true });
    expect(canTransition('pending', 'confirmed', 'system')).toEqual({ ok: false, reason: 'not_allowed' });
    expect(canTransition('serving', 'completed', 'system')).toEqual({ ok: false, reason: 'not_allowed' });
  });

  it('allows a late truck to still check in', () => {
    expect(canTransition('late', 'checked_in', 'staff')).toEqual({ ok: true });
  });
});

describe('transition predicates', () => {
  it('detects confirm, arrival and call', () => {
    expect(isConfirmTransition('pending', 'confirmed')).toBe(true);
    expect(isConfirmTransition('late', 'confirmed')).toBe(false);
    expect(isArrivalTransition('late', 'checked_in')).toBe(true);
    expect(isArrivalTransition('called', 'checked_in')).toBe(false);
    expect(isCallTransition('checked_in', 'called')).toBe(true);
    expect(isCallTransition('called', 'called')).toBe(true);
    expect(isCallTransition('confirmed', 'called')).toBe(false);
  });

  it('knows when a dock is released', () => {
    expect(freesDock('serving', 'completed')).toBe(true);
    expect(freesDock('called', 'no_show')).toBe(true);
    expect(freesDock('called', 'checked_in')).toBe(true);
    expect(freesDock('called', 'serving')).toBe(false);
    expect(freesDock('confirmed', 'cancelled')).toBe(false);
  });
});

describe('transitionStamps', () => {
  const now = new Date('2026-09-21T02:00:00.000Z');
  const ctx = { now, actorId: 'u1', callCount: 1, calledTimeoutMinutes: 15 };

  it('stamps a call with count and timeout', () => {
    expect(transitionStamps('checked_in', 'called', ctx)).toEqual({
      called_at: '2026-09-21T02:00:00.000Z',
      called_by: 'u1',
      call_count: 2,
      called_timeout_at: '2026-09-21T02:15:00.000Z',
      auto_called: false,
    });
  });

  it('marks auto calls and leaves called_by empty', () => {
    const s = transitionStamps('checked_in', 'called', { ...ctx, actorId: null, auto: true });
    expect(s.auto_called).toBe(true);
    expect(s.called_by).toBeNull();
  });

  it('clears the call when it is taken back', () => {
    expect(transitionStamps('called', 'checked_in', ctx)).toEqual({ called_at: null, called_timeout_at: null, auto_called: false });
  });

  it('stamps arrival, service start, completion and cancel', () => {
    expect(transitionStamps('confirmed', 'checked_in', ctx)).toEqual({ arrived_at: now.toISOString(), checked_in_at: now.toISOString() });
    expect(transitionStamps('called', 'serving', ctx)).toEqual({ serving_started_at: now.toISOString() });
    expect(transitionStamps('serving', 'completed', ctx)).toEqual({ completed_at: now.toISOString() });
    expect(transitionStamps('confirmed', 'cancelled', ctx)).toEqual({ cancelled_by: 'u1' });
  });
});
