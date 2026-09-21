import { describe, expect, it } from 'vitest';
import { dockErrorResponse } from '@/lib/booking/server';

describe('dockErrorResponse', () => {
  it('maps dock_conflict to 409 so an overlapping approval is refused with Thai copy', () => {
    const mapped = dockErrorResponse('dock_conflict');
    expect(mapped?.status).toBe(409);
    expect(mapped?.code).toBe('dock_conflict');
    expect(mapped?.error).toContain('ท่านี้มีคิวอื่น');
  });

  it('finds the code inside a full Postgres error message', () => {
    expect(dockErrorResponse('ERROR: dock_conflict\nCONTEXT: PL/pgSQL function bookings_dock_overlap_guard()')?.code).toBe('dock_conflict');
  });

  it('keeps duration_conflict and payment_required distinct from dock_conflict', () => {
    expect(dockErrorResponse('duration_conflict')?.code).toBe('duration_conflict');
    expect(dockErrorResponse('payment_required')?.code).toBe('payment_required');
    expect(dockErrorResponse('slot_unavailable')?.code).toBe('slot_unavailable');
  });

  it('returns null for unknown or empty messages', () => {
    expect(dockErrorResponse('something else')).toBeNull();
    expect(dockErrorResponse(null)).toBeNull();
    expect(dockErrorResponse(undefined)).toBeNull();
  });
});
