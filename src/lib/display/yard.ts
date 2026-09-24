/**
 * Pure layout rules for the 2D yard scene on the TV (`YardScene`).
 * Kept out of the component so the truck-type mapping and the queue cap can be
 * unit-tested without rendering SVG.
 */

export type TruckKind = 'trailer' | 'ten' | 'six' | 'four';

/** Body length of each truck kind in scene units (cab excluded). */
export const TRUCK_BODY_LENGTH: Record<TruckKind, number> = { trailer: 150, ten: 120, six: 96, four: 70 };

/** Highest number of waiting trucks drawn in the lane; the rest collapse into "+N". */
export const MAX_WAITING_TRUCKS = 6;

/**
 * Truck silhouette for a vehicle-type name ("รถ 10 ล้อ", "เทรลเลอร์", "6 wheels").
 * Unknown names fall back to a mid-size truck so every queue still gets a vehicle.
 */
export function truckKind(serviceName: string | null | undefined): TruckKind {
  const s = (serviceName ?? '').toLowerCase();
  if (/เทรลเลอร์|trailer|พ่วง|18\s*ล้อ|22\s*ล้อ/.test(s)) return 'trailer';
  if (/10\s*ล้อ|สิบล้อ|12\s*ล้อ|10\s*wheel/.test(s)) return 'ten';
  if (/6\s*ล้อ|หกล้อ|6\s*wheel/.test(s)) return 'six';
  if (/4\s*ล้อ|สี่ล้อ|กระบะ|pickup|4\s*wheel|ตู้/.test(s)) return 'four';
  return 'six';
}

/** Thai direction label shown on a dock door. */
export function directionLabel(direction: 'inbound' | 'outbound' | null | undefined): string {
  return direction === 'outbound' ? 'รับสินค้า' : direction === 'inbound' ? 'ส่งสินค้า' : 'รับ / ส่ง';
}

export type YardDockInput = { id: string; name: string; direction: 'inbound' | 'outbound' | null; current: YardTruckInput | null };
export type YardTruckInput = { id: string; queue_number: string; plate: string; status: string; service_name: string | null; start_time?: string | null };

export type YardDock = {
  id: string;
  name: string;
  direction: string;
  /** Left edge of the door in scene units. */
  x: number;
  width: number;
  state: 'idle' | 'calling' | 'serving';
  truck: YardTruck | null;
};

export type YardTruck = {
  id: string;
  queue: string;
  plate: string;
  kind: TruckKind;
  /** Body length in scene units. */
  length: number;
  time: string;
  calling: boolean;
};

export type YardLayout = {
  docks: YardDock[];
  waiting: YardTruck[];
  /** Waiting trucks not drawn because of the cap. */
  overflow: number;
};

/**
 * Splits the yard width into one door per dock and picks which waiting trucks
 * are drawn. Docks keep the feed order (sorted by resource code on the server),
 * waiting keeps the feed order (start_time, then check-in).
 *
 * @param docks Docks from the display feed.
 * @param waiting Checked-in queues not yet called.
 * @param width Scene width in scene units the docks may spread across.
 * @param max Cap on drawn waiting trucks.
 */
export function sceneLayout(docks: YardDockInput[], waiting: YardTruckInput[], width = 1000, max = MAX_WAITING_TRUCKS): YardLayout {
  const n = Math.max(docks.length, 1);
  const slot = width / n;
  const toTruck = (t: YardTruckInput): YardTruck => {
    const kind = truckKind(t.service_name);
    return { id: t.id, queue: t.queue_number, plate: t.plate || '-', kind, length: TRUCK_BODY_LENGTH[kind], time: String(t.start_time ?? '').slice(0, 5), calling: t.status === 'called' };
  };
  const laid: YardDock[] = docks.map((d, i) => {
    const truck = d.current ? toTruck(d.current) : null;
    return {
      id: d.id,
      name: d.name,
      direction: directionLabel(d.direction),
      x: i * slot,
      width: slot,
      state: !truck ? 'idle' : truck.calling ? 'calling' : 'serving',
      truck,
    };
  });
  const cap = Math.max(0, max);
  return { docks: laid, waiting: waiting.slice(0, cap).map(toTruck), overflow: Math.max(0, waiting.length - cap) };
}
