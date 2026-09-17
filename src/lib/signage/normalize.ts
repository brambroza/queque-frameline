import type { CustomerNameMode, SignageConfig, SignageData, SignagePerson } from './types';

/** Statuses that mean "this queue is being called / served right now". */
export const SIGNAGE_CALLING_STATUSES = ['called', 'serving', 'in_service'] as const;
/** Statuses that mean "still in line". */
export const SIGNAGE_QUEUED_STATUSES = ['waiting', 'checked_in', 'confirmed'] as const;
/** Statuses counted as served today (shown only as a total). */
export const SIGNAGE_SERVED_STATUSES = ['completed', 'seating'] as const;

export const SIGNAGE_ALL_STATUSES = [
  ...SIGNAGE_CALLING_STATUSES,
  ...SIGNAGE_QUEUED_STATUSES,
  ...SIGNAGE_SERVED_STATUSES,
];

/** Columns both display routes must select so `buildSignageData` sees the same shape. */
export const SIGNAGE_BOOKING_SELECT =
  'id,queue_number,status,start_time,called_at,resource_name,branch_id,customers(full_name,nickname),line_users(display_name),services(service_name)';

type SignageCustomer = { full_name?: string | null; nickname?: string | null };

/** Booking row as returned by `SIGNAGE_BOOKING_SELECT`. */
export type SignageBookingRow = {
  id: string;
  queue_number: string;
  status: string;
  start_time: string | null;
  called_at: string | null;
  resource_name: string | null;
  branch_id: string | null;
  customers: SignageCustomer | SignageCustomer[] | null;
  line_users: { display_name?: string | null } | { display_name?: string | null }[] | null;
  services: { service_name?: string | null } | { service_name?: string | null }[] | null;
};

function first<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

/**
 * Reduce a customer name according to the shop's privacy setting.
 * `masked` keeps only the first character and never reveals the real length.
 */
export function applyNameMode(name: string | null | undefined, mode: CustomerNameMode): string | null {
  const trimmed = name?.trim() ?? '';
  if (!trimmed) return null;
  if (mode === 'hidden') return null;
  if (mode === 'full') return trimmed;
  return `${trimmed.slice(0, 1)}***`;
}

function toHHMM(value: string | null | undefined): string | null {
  if (!value) return null;
  return String(value).slice(0, 5);
}

/**
 * Name the signage shows for a booking. A nickname is something the customer
 * chose to be called by, so it is shown in full regardless of the masking
 * mode; only `hidden` suppresses it. Without a nickname the real name goes
 * through `applyNameMode` as before.
 */
export function signageDisplayName(
  customer: SignageCustomer | null,
  lineDisplayName: string | null | undefined,
  mode: CustomerNameMode,
): string | null {
  if (mode === 'hidden') return null;
  const nickname = customer?.nickname?.trim();
  if (nickname) return nickname;
  return applyNameMode(customer?.full_name ?? lineDisplayName ?? null, mode);
}

function toPerson(row: SignageBookingRow, config: SignageConfig): SignagePerson {
  return {
    id: row.id,
    queue_number: row.queue_number,
    status: row.status,
    start_time: toHHMM(row.start_time),
    called_at: row.called_at ?? null,
    customer_name: signageDisplayName(first(row.customers), first(row.line_users)?.display_name, config.customer_name_mode),
    service_name: config.show_service_name ? first(row.services)?.service_name ?? null : null,
    resource_name: config.show_resource_name ? row.resource_name ?? null : null,
  };
}

function byStartTime(a: SignageBookingRow, b: SignageBookingRow): number {
  const t = (a.start_time ?? '').localeCompare(b.start_time ?? '');
  return t !== 0 ? t : a.queue_number.localeCompare(b.queue_number, undefined, { numeric: true });
}

export type BuildSignageDataInput = {
  rows: SignageBookingRow[];
  config: SignageConfig;
  date: string;
  shop: { name: string; logo_url?: string | null; demo_mode_enabled?: boolean | null; liff_id?: string | null };
  branch: { id: string; name: string } | null;
};

/**
 * Turn raw booking rows into the payload the signage renders.
 * Shared by the public TV route and the portal preview route so both show the same thing.
 */
export function buildSignageData(input: BuildSignageDataInput): SignageData {
  const { rows, config } = input;
  const calling = new Set<string>(SIGNAGE_CALLING_STATUSES);
  const queued = new Set<string>(SIGNAGE_QUEUED_STATUSES);
  const served = new Set<string>(SIGNAGE_SERVED_STATUSES);

  const nowCalling = rows
    .filter((r) => calling.has(r.status))
    .sort((a, b) => {
      const ca = a.called_at ?? '';
      const cb = b.called_at ?? '';
      if (ca !== cb) return cb.localeCompare(ca);
      return byStartTime(a, b);
    });

  const queuedRows = rows.filter((r) => queued.has(r.status)).sort(byStartTime);
  const nextQueue = queuedRows.slice(0, config.next_queue_limit);
  const waitingQueue = queuedRows.slice(config.next_queue_limit, config.next_queue_limit + config.waiting_queue_limit);

  const qrUrl = config.show_qr && input.shop.liff_id ? `https://liff.line.me/${input.shop.liff_id}` : null;

  return {
    date: input.date,
    generated_at: new Date().toISOString(),
    shop: {
      name: input.shop.name,
      logo_url: config.show_logo ? input.shop.logo_url ?? null : null,
      demo_mode_enabled: Boolean(input.shop.demo_mode_enabled),
    },
    branch: input.branch,
    now_calling: nowCalling.map((r) => toPerson(r, config)),
    next_queue: nextQueue.map((r) => toPerson(r, config)),
    waiting_queue: waitingQueue.map((r) => toPerson(r, config)),
    totals: {
      waiting: queuedRows.length,
      calling: nowCalling.length,
      served_today: rows.filter((r) => served.has(r.status)).length,
    },
    qr_url: qrUrl,
  };
}
