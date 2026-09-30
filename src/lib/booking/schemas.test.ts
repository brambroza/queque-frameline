import { describe, expect, it } from 'vitest';
import { bookingDurationSchema, bookingStatusPatchSchema, customerVehicleChangeSchema, dockBookingSchema, documentPaymentSchema, rescheduleSchema } from './schemas';

describe('dockBookingSchema', () => {
  const doc = '33333333-3333-4333-8333-333333333333';
  const base = { direction: 'outbound', service_id: '44444444-4444-4444-8444-444444444444', booking_date: '2026-09-30', start_time: '10:00', plate_number: '70-1234' };
  it('takes a partner name or a document for an ordinary queue', () => {
    expect(dockBookingSchema.safeParse({ ...base, partner_name: 'ลูกค้า ก' }).success).toBe(true);
    expect(dockBookingSchema.safeParse({ ...base, document_id: doc }).success).toBe(true);
    expect(dockBookingSchema.safeParse(base).success).toBe(false);
  });
  it('requires an SO/PO for a walk-in', () => {
    expect(dockBookingSchema.safeParse({ ...base, walk_in: true, document_id: doc }).success).toBe(true);
    const r = dockBookingSchema.safeParse({ ...base, walk_in: true, partner_name: 'ลูกค้า ก', document_id: '' });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues.some((i) => i.path[0] === 'document_id')).toBe(true);
    expect(dockBookingSchema.safeParse({ ...base, walk_in: false, partner_name: 'ลูกค้า ก' }).success).toBe(true);
    expect(dockBookingSchema.safeParse({ ...base, walk_in: 'yes', document_id: doc }).success).toBe(false);
  });
});

describe('customerVehicleChangeSchema', () => {
  const id = '22222222-2222-4222-8222-222222222222';
  it('accepts a plate with optional driver, blanks become undefined', () => {
    const r = customerVehicleChangeSchema.safeParse({ booking_id: id, plate_number: '70-1234', driver_name: '', driver_phone: '' });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.driver_name).toBeUndefined();
      expect(r.data.driver_phone).toBeUndefined();
    }
  });
  it('rejects an implausible plate or a bad phone', () => {
    expect(customerVehicleChangeSchema.safeParse({ booking_id: id, plate_number: 'ab' }).success).toBe(false);
    expect(customerVehicleChangeSchema.safeParse({ booking_id: id, plate_number: '70-1234', driver_phone: '12' }).success).toBe(false);
    expect(customerVehicleChangeSchema.safeParse({ booking_id: 'nope', plate_number: '70-1234' }).success).toBe(false);
  });
});

describe('rescheduleSchema', () => {
  const base = { booking_date: '2026-09-22', start_time: '14:00' };
  it('accepts a move without minutes (keeps the queue time)', () => {
    const r = rescheduleSchema.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.service_minutes).toBeUndefined();
  });
  it('accepts minutes set together with the move, within 5–1440', () => {
    expect(rescheduleSchema.safeParse({ ...base, service_minutes: 90 }).success).toBe(true);
    expect(rescheduleSchema.safeParse({ ...base, service_minutes: '90' }).success).toBe(true);
    expect(rescheduleSchema.safeParse({ ...base, service_minutes: 3 }).success).toBe(false);
    expect(rescheduleSchema.safeParse({ ...base, service_minutes: 1441 }).success).toBe(false);
  });
});

const ID = '11111111-1111-4111-8111-111111111111';

describe('bookingStatusPatchSchema', () => {
  it('requires a reason to cancel', () => {
    const missing = bookingStatusPatchSchema.safeParse({ id: ID, status: 'cancelled' });
    expect(missing.success).toBe(false);
    if (!missing.success) expect(missing.error.issues[0].path).toEqual(['cancel_reason']);
    expect(bookingStatusPatchSchema.safeParse({ id: ID, status: 'cancelled', cancel_reason: '  ' }).success).toBe(false);
    expect(bookingStatusPatchSchema.safeParse({ id: ID, status: 'cancelled', cancel_reason: 'ab' }).success).toBe(false);
  });

  it('accepts a cancellation with a reason', () => {
    const r = bookingStatusPatchSchema.safeParse({ id: ID, status: 'cancelled', cancel_reason: ' ลูกค้าขอยกเลิก ' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.cancel_reason).toBe('ลูกค้าขอยกเลิก');
  });

  it('does not ask other transitions for a reason', () => {
    expect(bookingStatusPatchSchema.safeParse({ id: ID, status: 'checked_in' }).success).toBe(true);
    expect(bookingStatusPatchSchema.safeParse({ id: ID, status: 'no_show' }).success).toBe(true);
  });

  it('takes the dock time on approval, within 5–1440 minutes', () => {
    const ok = bookingStatusPatchSchema.safeParse({ id: ID, status: 'confirmed', service_minutes: '90' });
    expect(ok.success).toBe(true);
    if (ok.success) expect(ok.data.service_minutes).toBe(90);
    expect(bookingStatusPatchSchema.safeParse({ id: ID, status: 'confirmed' }).success).toBe(true);
    expect(bookingStatusPatchSchema.safeParse({ id: ID, status: 'confirmed', service_minutes: 4 }).success).toBe(false);
    expect(bookingStatusPatchSchema.safeParse({ id: ID, status: 'confirmed', service_minutes: 1441 }).success).toBe(false);
    expect(bookingStatusPatchSchema.safeParse({ id: ID, status: 'confirmed', service_minutes: 45.5 }).success).toBe(false);
  });
});

describe('bookingDurationSchema', () => {
  it('validates the range', () => {
    expect(bookingDurationSchema.safeParse({ service_minutes: 120 }).success).toBe(true);
    expect(bookingDurationSchema.safeParse({ service_minutes: 0 }).success).toBe(false);
    expect(bookingDurationSchema.safeParse({}).success).toBe(false);
  });
});

describe('documentPaymentSchema', () => {
  it('accepts the three statuses and blanks out empty text', () => {
    const r = documentPaymentSchema.safeParse({ payment_status: 'paid', payment_ref: '', payment_note: ' โอนแล้ว ' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toEqual({ payment_status: 'paid', payment_ref: undefined, payment_note: 'โอนแล้ว' });
    expect(documentPaymentSchema.safeParse({ payment_status: 'credit' }).success).toBe(true);
  });

  it('rejects anything else', () => {
    expect(documentPaymentSchema.safeParse({ payment_status: 'partial' }).success).toBe(false);
    expect(documentPaymentSchema.safeParse({}).success).toBe(false);
    expect(documentPaymentSchema.safeParse({ payment_status: 'paid', payment_ref: 'x'.repeat(81) }).success).toBe(false);
  });
});
