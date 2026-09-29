/**
 * Pure rules of the portal activity log page: which filters a request may carry,
 * and how a stored row is turned into words. No I/O — covered by vitest.
 */

export type ActivityOp = 'create' | 'update' | 'delete' | 'other';

export type ActivityFilters = {
  op: ActivityOp | null;
  table: string | null;
  userId: string | null;
  /** Inclusive ISO instants (Bangkok day boundaries). */
  from: string | null;
  to: string | null;
  page: number;
  pageSize: number;
};

export const ACTIVITY_PAGE_SIZE_MAX = 100;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TABLE_PATTERN = /^[a-z_]{1,60}$/;

/** Tables the portal writes to, with the name of the screen staff know them by. */
export const ACTIVITY_TABLES: Array<{ table: string; label: string }> = [
  { table: 'bookings', label: 'คิวรับ-ส่งสินค้า' },
  { table: 'external_documents', label: 'เอกสาร SO / PO' },
  { table: 'customers', label: 'คู่ค้า' },
  { table: 'branches', label: 'สาขา' },
  { table: 'booking_resources', label: 'ท่ารับ-ส่งสินค้า' },
  { table: 'services', label: 'ประเภทรถ' },
  { table: 'working_hours', label: 'เวลาทำการ' },
  { table: 'holidays', label: 'วันหยุด' },
  { table: 'staff', label: 'พนักงาน' },
  { table: 'roles', label: 'สิทธิ์และเมนู' },
  { table: 'site_settings', label: 'ตั้งค่าระบบคิว' },
  { table: 'shops', label: 'ข้อมูลคลัง' },
  { table: 'settings', label: 'ตั้งค่าอื่น ๆ' },
  { table: 'line_config', label: 'เชื่อมต่อ LINE' },
  { table: 'api_keys', label: 'API key (ERP)' },
  { table: 'translations', label: 'การแปลภาษา' },
  { table: 'users_profile', label: 'โปรไฟล์ผู้ใช้' },
  { table: 'feedback_reports', label: 'แจ้งปัญหา / ข้อเสนอแนะ' },
];

const TABLE_LABELS = new Map(ACTIVITY_TABLES.map((t) => [t.table, t.label]));

export const ACTIVITY_OP_LABELS: Record<ActivityOp, string> = {
  create: 'เพิ่ม',
  update: 'แก้ไข',
  delete: 'ลบ',
  other: 'อื่น ๆ',
};

/** Actions that are not `data_*` but still are a create / update / delete. */
const ACTION_OPS: Record<string, ActivityOp> = {
  data_created: 'create',
  data_updated: 'update',
  data_deleted: 'delete',
  role_created: 'create',
  role_updated: 'update',
  role_deleted: 'delete',
  api_key_created: 'create',
  api_key_revoked: 'delete',
  feedback_submitted: 'create',
};

/** Keys never worth showing in the one-line summary. */
const SUMMARY_SKIP = new Set(['soft_delete', 'ref', 'company_id', 'shop_id', 'created_by', 'updated_by']);

/** Keys that name the row, shown first so the line starts with "what". */
const SUMMARY_FIRST = ['queue_number', 'doc_no', 'full_name', 'display_name', 'branch_name', 'resource_name', 'service_name', 'name', 'code', 'key', 'holiday_date', 'translation_key'];

const SUMMARY_MAX_PARTS = 4;
const SUMMARY_MAX_VALUE = 60;

/** Operation a stored action stands for. */
export function opOfAction(action: string | null | undefined): ActivityOp {
  return ACTION_OPS[String(action ?? '')] ?? 'other';
}

/** Every stored action that counts as the given operation (for the `in` filter). */
export function actionsOfOp(op: Exclude<ActivityOp, 'other'>): string[] {
  return Object.entries(ACTION_OPS)
    .filter(([, value]) => value === op)
    .map(([action]) => action);
}

/** Every action with a known operation — "other" is whatever is not in this list. */
export function knownActions(): string[] {
  return Object.keys(ACTION_OPS);
}

/** Screen name of a table, or the raw table name when it is not a known one. */
export function tableLabel(table: string | null | undefined): string {
  if (!table) return '-';
  return TABLE_LABELS.get(table) ?? table;
}

function positiveInt(value: string | null, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : fallback;
}

function isRealDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/**
 * Reads the filters off a query string. Anything malformed is dropped rather than
 * passed on, so a hand-edited URL can never reach the query builder unchecked.
 * Dates are Bangkok calendar days; a reversed range is swapped.
 */
export function parseActivityFilters(params: URLSearchParams): ActivityFilters {
  const opRaw = params.get('op');
  const op: ActivityOp | null = opRaw === 'create' || opRaw === 'update' || opRaw === 'delete' || opRaw === 'other' ? opRaw : null;

  const tableRaw = params.get('table');
  const table = tableRaw && TABLE_PATTERN.test(tableRaw) ? tableRaw : null;

  const userRaw = params.get('user_id');
  const userId = userRaw && UUID_PATTERN.test(userRaw) ? userRaw : null;

  let fromDay = params.get('from');
  let toDay = params.get('to');
  if (fromDay && !isRealDate(fromDay)) fromDay = null;
  if (toDay && !isRealDate(toDay)) toDay = null;
  if (fromDay && toDay && fromDay > toDay) [fromDay, toDay] = [toDay, fromDay];

  return {
    op,
    table,
    userId,
    from: fromDay ? `${fromDay}T00:00:00+07:00` : null,
    to: toDay ? `${toDay}T23:59:59.999+07:00` : null,
    page: positiveInt(params.get('page'), 1),
    pageSize: Math.min(positiveInt(params.get('page_size'), 20), ACTIVITY_PAGE_SIZE_MAX),
  };
}

function showValue(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'boolean') return value ? 'ใช่' : 'ไม่';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') return value.length > SUMMARY_MAX_VALUE ? `${value.slice(0, SUMMARY_MAX_VALUE)}…` : value;
  if (Array.isArray(value)) return value.length === 0 ? null : `${value.length} รายการ`;
  if (typeof value === 'object') {
    const pair = value as { from?: unknown; to?: unknown };
    if ('from' in pair || 'to' in pair) return `${showValue(pair.from) ?? '-'} → ${showValue(pair.to) ?? '-'}`;
    return null;
  }
  return null;
}

/**
 * One line that tells what the row was about: naming keys first, then the first
 * few other values. Nested objects (other than `{ from, to }`) are left to the
 * detail dialog.
 */
export function summarizePayload(payload: unknown): string {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return '';
  const record = payload as Record<string, unknown>;
  const keys = Object.keys(record).filter((key) => !SUMMARY_SKIP.has(key));
  const ordered = [...SUMMARY_FIRST.filter((key) => keys.includes(key)), ...keys.filter((key) => !SUMMARY_FIRST.includes(key))];

  const parts: string[] = [];
  for (const key of ordered) {
    if (parts.length >= SUMMARY_MAX_PARTS) break;
    const shown = showValue(record[key]);
    if (shown === null) continue;
    parts.push(SUMMARY_FIRST.includes(key) ? shown : `${key}: ${shown}`);
  }
  return parts.join(' · ');
}
