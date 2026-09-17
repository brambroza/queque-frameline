import { describe, expect, it } from 'vitest';
import { compareStatus, getStatusMeta, shouldNotifyCancellation, statusOccupiesSlot } from './status-meta';

describe('shouldNotifyCancellation', () => {
  it('notifies when a live booking is cancelled for the first time', () => {
    expect(shouldNotifyCancellation({ status: 'confirmed' })).toBe(true);
    expect(shouldNotifyCancellation({ status: 'waiting', is_deleted: false })).toBe(true);
  });

  it('does not push a second notice for a booking that is already cancelled', () => {
    expect(shouldNotifyCancellation({ status: 'cancelled' })).toBe(false);
  });

  it('does not notify for a booking that was already soft-deleted', () => {
    expect(shouldNotifyCancellation({ status: 'confirmed', is_deleted: true })).toBe(false);
  });

  it('does not notify without a prior row', () => {
    expect(shouldNotifyCancellation(null)).toBe(false);
    expect(shouldNotifyCancellation(undefined)).toBe(false);
  });
});

describe('status metadata', () => {
  it('keeps the chip palette of every legacy status', () => {
    expect(getStatusMeta('pending').palette).toBe('warning');
    expect(getStatusMeta('pending_approval').palette).toBe('info');
    expect(getStatusMeta('confirmed').palette).toBe('primary');
    expect(getStatusMeta('waiting').palette).toBe('secondary');
    expect(getStatusMeta('serving').palette).toBe('success');
    expect(getStatusMeta('completed').palette).toBe('success');
    expect(getStatusMeta('cancelled').palette).toBe('error');
    expect(getStatusMeta('no_show').palette).toBe('default');
  });

  it('falls back to a neutral entry for unknown statuses', () => {
    expect(getStatusMeta('mystery')).toMatchObject({ palette: 'default', occupies: true });
  });

  it('frees the slot only for terminal non-service statuses', () => {
    expect(statusOccupiesSlot('confirmed')).toBe(true);
    expect(statusOccupiesSlot('cancelled')).toBe(false);
    expect(statusOccupiesSlot('no_show')).toBe(false);
    expect(statusOccupiesSlot('skipped')).toBe(false);
  });

  it('sorts in booking-flow order', () => {
    expect(['cancelled', 'serving', 'pending'].sort(compareStatus)).toEqual(['pending', 'serving', 'cancelled']);
  });
});
