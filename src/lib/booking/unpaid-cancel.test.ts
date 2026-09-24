import { describe, expect, it } from 'vitest';
import { computeUnpaidActions, paymentDeadline, type UnpaidCandidate } from './unpaid-cancel';

// Booked 2026-09-21 09:00 Bangkok (02:00Z) for a 14:00 Bangkok (07:00Z) appointment.
const at = (hhmmZ: string) => new Date(`2026-09-21T${hhmmZ}:00Z`);
const row = (o: Partial<UnpaidCandidate> = {}): UnpaidCandidate => ({
  id: 'u1', status: 'pending', booking_source: 'customer_link', created_at: '2026-09-21T02:00:00Z', payment_updated_at: null,
  booking_date: '2026-09-21', start_time: '14:00:00', payment_warned_at: null, ...o,
});
const cfg = { unpaid_cancel_enabled: true, unpaid_cancel_minutes: 60, unpaid_warn_minutes: 15 };

describe('paymentDeadline', () => {
  it('is booking + N minutes, capped at the appointment', () => {
    expect(paymentDeadline(row(), cfg)?.toISOString()).toBe('2026-09-21T03:00:00.000Z');
    expect(paymentDeadline(row(), { ...cfg, unpaid_cancel_minutes: 600 })?.toISOString()).toBe('2026-09-21T07:00:00.000Z');
    expect(paymentDeadline(row({ start_time: '14:00' }), { ...cfg, unpaid_cancel_minutes: 600 })?.toISOString()).toBe('2026-09-21T07:00:00.000Z');
  });
  it('restarts from a later payment change (paid → unpaid again)', () => {
    expect(paymentDeadline(row({ payment_updated_at: '2026-09-21T02:30:00Z' }), cfg)?.toISOString()).toBe('2026-09-21T03:30:00.000Z');
    // An older payment stamp (set before the booking) does not move the anchor.
    expect(paymentDeadline(row({ payment_updated_at: '2026-09-20T02:30:00Z' }), cfg)?.toISOString()).toBe('2026-09-21T03:00:00.000Z');
  });
  it('is null when disabled or unreadable', () => {
    expect(paymentDeadline(row(), { ...cfg, unpaid_cancel_enabled: false })).toBeNull();
    expect(paymentDeadline(row({ created_at: 'nope' }), cfg)).toBeNull();
    expect(paymentDeadline(row({ booking_date: 'nope' }), cfg)?.toISOString()).toBe('2026-09-21T03:00:00.000Z');
  });
});

describe('computeUnpaidActions', () => {
  it('warns W minutes before the deadline, once', () => {
    expect(computeUnpaidActions([row()], at('02:44'), cfg)).toEqual({ warn: [], cancel: [] });
    expect(computeUnpaidActions([row()], at('02:45'), cfg)).toEqual({ warn: ['u1'], cancel: [] });
    expect(computeUnpaidActions([row({ payment_warned_at: '2026-09-21T02:45:00Z' })], at('02:50'), cfg)).toEqual({ warn: [], cancel: [] });
  });
  it('cancels at the deadline only after the warning window ran its course', () => {
    const warned = row({ payment_warned_at: '2026-09-21T02:45:00Z' });
    expect(computeUnpaidActions([warned], at('02:59'), cfg)).toEqual({ warn: [], cancel: [] });
    expect(computeUnpaidActions([warned], at('03:00'), cfg)).toEqual({ warn: [], cancel: ['u1'] });
    // Warned late (switch turned on with an old queue): still the full W minutes after the warning.
    const lateWarn = row({ payment_warned_at: '2026-09-21T05:00:00Z' });
    expect(computeUnpaidActions([lateWarn], at('05:10'), cfg)).toEqual({ warn: [], cancel: [] });
    expect(computeUnpaidActions([lateWarn], at('05:15'), cfg)).toEqual({ warn: [], cancel: ['u1'] });
  });
  it('warns first even when the deadline already passed', () => {
    expect(computeUnpaidActions([row()], at('06:00'), cfg)).toEqual({ warn: ['u1'], cancel: [] });
  });
  it('cancels straight at the deadline when the warning is off', () => {
    const noWarn = { ...cfg, unpaid_warn_minutes: 0 };
    expect(computeUnpaidActions([row()], at('02:59'), noWarn)).toEqual({ warn: [], cancel: [] });
    expect(computeUnpaidActions([row()], at('03:00'), noWarn)).toEqual({ warn: [], cancel: ['u1'] });
  });
  it('never touches disabled sites, staff-made queues, other statuses or bad rows', () => {
    expect(computeUnpaidActions([row()], at('06:00'), { ...cfg, unpaid_cancel_enabled: false })).toEqual({ warn: [], cancel: [] });
    expect(computeUnpaidActions([row({ booking_source: 'admin' }), row({ id: 'u2', booking_source: 'api' })], at('06:00'), cfg)).toEqual({ warn: [], cancel: [] });
    expect(computeUnpaidActions(['confirmed', 'late', 'cancelled'].map((status) => row({ status })), at('06:00'), cfg)).toEqual({ warn: [], cancel: [] });
    expect(computeUnpaidActions([row({ created_at: 'nope' })], at('06:00'), cfg)).toEqual({ warn: [], cancel: [] });
  });
  it('handles several rows independently', () => {
    const rows = [row(), row({ id: 'u2', payment_warned_at: '2026-09-21T02:45:00Z' }), row({ id: 'u3', created_at: '2026-09-21T05:00:00Z' })];
    expect(computeUnpaidActions(rows, at('03:00'), cfg)).toEqual({ warn: ['u1'], cancel: ['u2'] });
  });
});
