import { z } from 'zod';
import { isPlausiblePlate } from '@/lib/booking/plate';

export const directionSchema = z.enum(['inbound', 'outbound']);
/** '' / 'both' from a select = the row serves both directions (stored as null). */
export const nullableDirectionSchema = z.preprocess(
  (v) => (v === '' || v === 'both' || v === undefined ? null : v),
  directionSchema.nullable(),
);

export const branchSchema = z.object({
  /** Short code used by CSV / ERP imports to name the branch (e.g. HQ, BKK2). */
  code: z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? null : v), z.string().trim().max(20).regex(/^[A-Za-z0-9_-]+$/).nullable().optional()),
  branch_name: z.string().min(2),
  address: z.string().optional().default(''),
  phone: z.string().optional().default(''),
  open_time: z.string(),
  close_time: z.string(),
  max_parallel_queues: z.coerce.number().int().min(1).max(100),
  active: z.coerce.boolean().default(true),
});

export const serviceSchema = z.object({
  service_name: z.string().min(2),
  booking_mode: z.enum(['fixed_slot', 'flexible_duration', 'capacity_based', 'walk_in', 'request_approval']).default('fixed_slot'),
  duration_minutes: z.coerce.number().int().min(5).optional().nullable(),
  min_duration_minutes: z.coerce.number().int().min(5).optional().nullable(),
  max_duration_minutes: z.coerce.number().int().min(5).optional().nullable(),
  capacity_per_slot: z.coerce.number().int().min(1).default(1),
  requires_approval: z.coerce.boolean().default(false),
  allow_walk_in: z.coerce.boolean().default(false),
  price: z.coerce.number().nonnegative().default(0),
  active: z.coerce.boolean().default(true),
  /** Dock turnaround blocked after this vehicle type. */
  buffer_minutes: z.coerce.number().int().min(0).max(240).default(0),
  direction: nullableDirectionSchema.optional(),
  sort_order: z.coerce.number().int().min(0).max(9999).default(0),
});

export const workingHourSchema = z.object({
  branch_id: z.string().uuid(),
  weekday: z.coerce.number().int().min(0).max(6),
  open_time: z.string(),
  close_time: z.string(),
  break_start: z.string().nullable().optional(),
  break_end: z.string().nullable().optional(),
  slot_interval_minutes: z.coerce.number().int().min(5).max(180),
  capacity_per_slot: z.coerce.number().int().min(1).max(100),
  active: z.coerce.boolean().default(true),
  direction: nullableDirectionSchema.optional(),
});

/** HTML inputs send '' for an untouched field; treat that as "not provided". */
const emptyToUndefined = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v);

const optionalText = (max: number) => z.preprocess(emptyToUndefined, z.string().trim().max(max).optional());
const optionalUuid = z.preprocess(emptyToUndefined, z.string().uuid().optional().nullable());

export const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD');
export const slotTimeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, 'HH:MM');
export const phoneSchema = z.string().trim().min(8).max(20).regex(/^[0-9+\-\s()]+$/);
export const plateSchema = z.string().trim().min(2).max(30).refine(isPlausiblePlate, 'ทะเบียนรถไม่ถูกต้อง');

/** Vehicle / driver / receiver details — shared by the portal and the public booking link. */
export const vehicleDetailsSchema = z.object({
  plate_number: plateSchema,
  driver_name: optionalText(120),
  driver_phone: z.preprocess(emptyToUndefined, phoneSchema.optional()),
  receiver_name: optionalText(120),
  receiver_phone: z.preprocess(emptyToUndefined, phoneSchema.optional()),
  note: optionalText(500),
});

/**
 * Portal "สร้างคิว". The partner comes from `partner_id`, from the linked
 * document, or is created from `partner_name` + `partner_phone`.
 */
export const dockBookingSchema = vehicleDetailsSchema
  .extend({
    direction: directionSchema,
    service_id: z.string().uuid(),
    booking_date: isoDateSchema,
    start_time: slotTimeSchema,
    branch_id: optionalUuid,
    resource_id: optionalUuid,
    document_id: optionalUuid,
    partner_id: optionalUuid,
    partner_name: optionalText(160),
    partner_phone: z.preprocess(emptyToUndefined, phoneSchema.optional()),
  })
  .refine((v) => Boolean(v.partner_id || v.document_id || v.partner_name), {
    message: 'ต้องระบุคู่ค้า หรือเลือกเอกสาร SO/PO',
    path: ['partner_name'],
  });

export const bookingStatusPatchSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['confirmed', 'late', 'checked_in', 'called', 'serving', 'completed', 'cancelled', 'no_show']),
  cancel_reason: optionalText(300),
});

export const plateChangeSchema = z.object({
  plate_number_actual: plateSchema,
  reason: optionalText(300),
});

export const rescheduleSchema = z.object({
  booking_date: isoDateSchema,
  start_time: slotTimeSchema,
  resource_id: optionalUuid,
});

export const bookingResourceSchema = z.object({
  resource_type: z.enum(['dock', 'table', 'buffet_zone', 'meeting_room', 'counter', 'service_area', 'trainer']).default('dock'),
  resource_code: z.string().trim().min(1).max(40).optional().nullable(),
  resource_name: z.string().trim().min(1).max(120),
  capacity: z.coerce.number().int().min(1).max(1000).default(1),
  unit_price: z.coerce.number().nonnegative().default(0),
  floor: z.string().trim().max(50).optional().nullable(),
  zone: z.string().trim().max(80).optional().nullable(),
  description: z.string().trim().max(500).optional().nullable(),
  active: z.coerce.boolean().default(true),
  /** Vehicle types allowed on this dock; empty / omitted = every type. */
  service_ids: z.array(z.string().uuid()).max(200).optional().nullable(),
  direction: nullableDirectionSchema.optional(),
});

export const bookingResourceBulkSchema = z.object({
  /** Services every generated resource serves; empty / omitted = every service. */
  service_ids: z.array(z.string().uuid()).max(200).optional().nullable(),
  resource_type: z.enum(['dock', 'table', 'buffet_zone', 'meeting_room', 'counter', 'service_area', 'trainer']).default('dock'),
  branch_id: z.string().uuid().optional().nullable(),
  floor: z.string().trim().max(50).optional().nullable(),
  zone: z.string().trim().max(80).optional().nullable(),
  capacity: z.coerce.number().int().min(1).max(1000).default(1),
  mode: z.enum(['range', 'list']),
  prefix: z.string().trim().min(1).max(20).optional().nullable(),
  start_number: z.coerce.number().int().min(1).max(9999).optional().nullable(),
  end_number: z.coerce.number().int().min(1).max(9999).optional().nullable(),
  pad_length: z.coerce.number().int().min(0).max(6).optional().nullable(),
  code_list: z.array(z.string().trim().min(1).max(40)).optional(),
  name_prefix: z.string().trim().max(40).optional().nullable(),
  unit_price: z.coerce.number().nonnegative().default(0),
  active: z.coerce.boolean().default(true),
});
