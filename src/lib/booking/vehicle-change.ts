/**
 * Customer-side vehicle / driver change (from the booking link), pure part.
 *
 * The customer replaces the *booked* plate and driver before the truck reaches
 * the gate. This is different from the gate correction (`plate_number_actual`),
 * which staff record when the vehicle that shows up differs from the booking.
 */
import { normalizePlate, platesMatch } from '@/lib/booking/plate';

export type VehicleSnapshot = {
  plate_number: string | null;
  plate_number_actual: string | null;
  driver_name: string | null;
  driver_phone: string | null;
};

export type VehicleChangeInput = {
  plate_number: string;
  driver_name?: string | null;
  driver_phone?: string | null;
};

export type VehicleChangeDiff = {
  /** Booked plate before → after (normalised); `null` when unchanged. */
  plate: { from: string; to: string } | null;
  /** "ชื่อ · เบอร์" before → after; `null` when unchanged. */
  driver: { from: string; to: string } | null;
  /** Columns to write on `bookings`; empty when nothing changed. */
  update: Partial<VehicleSnapshot>;
};

/** "ชื่อ · เบอร์" for messages; '-' when both are blank. */
export function driverLabel(name: string | null | undefined, phone: string | null | undefined): string {
  const parts = [name?.trim(), phone?.trim()].filter((p): p is string => Boolean(p));
  return parts.length ? parts.join(' · ') : '-';
}

const trimOrNull = (v: string | null | undefined): string | null => {
  const t = v?.trim();
  return t ? t : null;
};

/**
 * Work out what the customer actually changed.
 *
 * - Plate is compared after normalisation, so retyping "กข 1234" as "กข-1234" is not a change.
 * - A gate correction (`plate_number_actual`) that now equals the new booked plate is cleared,
 *   because the booking and the vehicle at the gate agree again.
 * - Driver name / phone are trimmed; blank means "no driver given".
 */
export function diffVehicleChange(before: VehicleSnapshot, next: VehicleChangeInput): VehicleChangeDiff {
  const update: Partial<VehicleSnapshot> = {};

  const nextPlate = normalizePlate(next.plate_number);
  const prevPlate = normalizePlate(before.plate_number);
  let plate: VehicleChangeDiff['plate'] = null;
  if (nextPlate !== prevPlate) {
    plate = { from: prevPlate || '-', to: nextPlate };
    update.plate_number = nextPlate;
    if (before.plate_number_actual && platesMatch(before.plate_number_actual, nextPlate)) update.plate_number_actual = null;
  }

  const nextName = trimOrNull(next.driver_name);
  const nextPhone = trimOrNull(next.driver_phone);
  const prevName = trimOrNull(before.driver_name);
  const prevPhone = trimOrNull(before.driver_phone);
  let driver: VehicleChangeDiff['driver'] = null;
  if (nextName !== prevName || nextPhone !== prevPhone) {
    driver = { from: driverLabel(prevName, prevPhone), to: driverLabel(nextName, nextPhone) };
    update.driver_name = nextName;
    update.driver_phone = nextPhone;
  }

  return { plate, driver, update };
}

/** One-line audit description for `booking_logs`. */
export function describeVehicleChange(queueNo: string, diff: VehicleChangeDiff): string {
  const parts: string[] = [];
  if (diff.plate) parts.push(`ทะเบียน ${diff.plate.from} → ${diff.plate.to}`);
  if (diff.driver) parts.push(`คนขับ ${diff.driver.from} → ${diff.driver.to}`);
  return `${queueNo}: ลูกค้าเปลี่ยน${parts.length ? ' ' + parts.join(', ') : 'ข้อมูลรถ'} (ผ่านลิงก์)`;
}
