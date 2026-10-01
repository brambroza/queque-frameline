#!/usr/bin/env node
/**
 * Hard-delete bookings (dock queues) and, optionally, the Sales Orders /
 * Purchase Orders (`external_documents`) they belong to.
 *
 * Meant for cleaning test data on dev / staging. It can run against
 * production too, which is exactly why it is dry-run by default and refuses
 * to touch anything without `--yes`.
 *
 * Usage:
 *   node scripts/dev/delete-bookings.mjs <filter...> [options]
 *
 * Filters (at least one; several combine with AND):
 *   --all                     every booking of the shop
 *   --id=<uuid>[,<uuid>...]   specific booking ids
 *   --queue=<no>[,<no>...]    queue numbers (e.g. OUT-20260930-001)
 *   --date=YYYY-MM-DD         booking_date equals
 *   --from=YYYY-MM-DD         booking_date >= (inclusive)
 *   --to=YYYY-MM-DD           booking_date <= (inclusive)
 *   --before=YYYY-MM-DD       booking_date <  (exclusive) — for purging history
 *   --status=<s>[,<s>...]     pending|confirmed|waiting|serving|late|completed|cancelled|no_show
 *   --code=<customer code>    customer code (customers.code), e.g. C002
 *   --doc-prefix=<prefix>     documents whose doc_no starts with this, e.g. SO-TEST-
 *   --source=<s>[,<s>...]     booking_source: customer_link|admin|api|walk_in
 *
 * Options:
 *   --shop=<shop_key>  shop to work on (default SITE_SHOP_KEY from .env)
 *   --with-docs        also delete the SO/PO rows linked to the deleted bookings
 *                      (only documents that have no other booking left)
 *   --keep-doc-status  do NOT reset linked documents from 'booked' back to 'open'
 *   --keep-files       do NOT remove signature files from the storage bucket
 *   --purge-logs       also delete activity_logs rows that point at the bookings
 *                      (default: keep the audit trail)
 *   --yes              actually delete. Without it the script only prints the plan.
 *   --json             print a machine-readable trailer (__DELETE_JSON__{...})
 *
 * Examples:
 *   node scripts/dev/delete-bookings.mjs --doc-prefix=SO-TEST- --with-docs            # plan only
 *   node scripts/dev/delete-bookings.mjs --doc-prefix=SO-TEST- --with-docs --yes      # do it
 *   node scripts/dev/delete-bookings.mjs --date=2026-10-01 --status=cancelled,no_show --yes
 *   node scripts/dev/delete-bookings.mjs --before=2026-01-01 --yes                    # purge old history
 *   node scripts/dev/delete-bookings.mjs --all --with-docs --yes                      # wipe the shop
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and SITE_SHOP_KEY
 * from .env / .env.local (same as seed-test-data.mjs).
 *
 * What gets removed per booking (the Fameline schema — 202609170001 dropped
 * the payment / demo / calendar tables of the generic Queue product):
 *   booking_logs (no cascade), the close-out signature files in bucket
 *   `booking-signatures`, then the booking row. booking_resource_assignments
 *   and push_subscriptions cascade on their own.
 * What is left alone on purpose: do_counters (DO numbers stay gap-free going
 * forward; deleted DO numbers are simply never reused), notifications,
 * line_events, integration_logs, activity_logs (unless --purge-logs).
 */
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

try {
  if (typeof globalThis.WebSocket === 'undefined') {
    const wsModule = await import('ws');
    globalThis.WebSocket = wsModule.default;
  }
} catch {
  // Supabase client only needs WebSocket for realtime; ignore.
}

// ───────────────────────── env ─────────────────────────

/**
 * Load KEY=value lines from an env file into process.env without overriding
 * variables that are already exported.
 * @param {string} filePath
 */
function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const rawLine of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '');
    if (!(key in process.env)) process.env[key] = value;
  }
}
loadEnvFile(path.resolve(process.cwd(), '.env'));
loadEnvFile(path.resolve(process.cwd(), '.env.local'));

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing env: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// ───────────────────────── args ─────────────────────────

const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const m = a.match(/^--([^=]+)(?:=(.*))?$/);
  return m ? [m[1], m[2] ?? true] : [a, true];
}));

const KNOWN = new Set([
  'all', 'id', 'queue', 'date', 'from', 'to', 'before', 'status', 'code', 'doc-prefix', 'source',
  'shop', 'with-docs', 'keep-doc-status', 'keep-files', 'purge-logs', 'yes', 'json', 'help',
]);
const unknown = Object.keys(args).filter((k) => !KNOWN.has(k));
if (unknown.length || args.help) {
  if (unknown.length) console.error(`Unknown option(s): ${unknown.join(', ')}`);
  console.error('See the header of scripts/dev/delete-bookings.mjs for usage.');
  process.exit(unknown.length ? 1 : 0);
}

const SHOP_KEY = String(args.shop || process.env.SITE_SHOP_KEY || 'fameline');
const YES = args.yes === true;
const WITH_DOCS = args['with-docs'] === true;
const KEEP_DOC_STATUS = args['keep-doc-status'] === true;
const KEEP_FILES = args['keep-files'] === true;
const PURGE_LOGS = args['purge-logs'] === true;
const JSON_OUT = args.json === true;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const BOOKING_STATUSES = ['pending', 'confirmed', 'waiting', 'serving', 'late', 'completed', 'cancelled', 'no_show'];
const BOOKING_SOURCES = ['customer_link', 'admin', 'api', 'walk_in'];

/**
 * Split a comma list option into trimmed, non-empty strings.
 * @param {unknown} v
 * @returns {string[]}
 */
function list(v) {
  if (typeof v !== 'string') return [];
  return v.split(',').map((s) => s.trim()).filter(Boolean);
}

/**
 * Validate a YYYY-MM-DD option, exiting with a message when malformed.
 * @param {string} name
 * @returns {string | null}
 */
function dateArg(name) {
  const v = args[name];
  if (v === undefined) return null;
  if (typeof v !== 'string' || !DATE_RE.test(v)) {
    console.error(`--${name} must be YYYY-MM-DD`);
    process.exit(1);
  }
  return v;
}

const filter = {
  all: args.all === true,
  ids: list(args.id),
  queues: list(args.queue).map((q) => q.toUpperCase()),
  date: dateArg('date'),
  from: dateArg('from'),
  to: dateArg('to'),
  before: dateArg('before'),
  statuses: list(args.status),
  code: typeof args.code === 'string' ? args.code.toUpperCase() : null,
  docPrefix: typeof args['doc-prefix'] === 'string' ? args['doc-prefix'] : null,
  sources: list(args.source),
};

const hasFilter = filter.all || filter.ids.length || filter.queues.length || filter.date || filter.from
  || filter.to || filter.before || filter.statuses.length || filter.code || filter.docPrefix || filter.sources.length;
if (!hasFilter) {
  console.error('Refusing to run without a filter. Pass --all to mean every booking of the shop.');
  process.exit(1);
}
const badStatus = filter.statuses.filter((s) => !BOOKING_STATUSES.includes(s));
if (badStatus.length) {
  console.error(`Unknown status: ${badStatus.join(', ')} (valid: ${BOOKING_STATUSES.join('|')})`);
  process.exit(1);
}
const badSource = filter.sources.filter((s) => !BOOKING_SOURCES.includes(s));
if (badSource.length) {
  console.error(`Unknown source: ${badSource.join(', ')} (valid: ${BOOKING_SOURCES.join('|')})`);
  process.exit(1);
}

// ───────────────────────── helpers ─────────────────────────

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

/**
 * Unwrap a Supabase response, exiting on error.
 * @template T
 * @param {{ data: T, error: { message: string } | null }} res
 * @param {string} what
 * @returns {T}
 */
function must(res, what) {
  if (res.error) {
    console.error(`✗ ${what}: ${res.error.message}`);
    process.exit(1);
  }
  return res.data;
}

/**
 * Split an array into chunks so `.in()` filters stay within URL limits.
 * @template T
 * @param {T[]} arr
 * @param {number} size
 * @returns {T[][]}
 */
function chunk(arr, size = 200) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/**
 * Run a delete per id chunk and return the number of rows removed.
 * @param {string} table
 * @param {string} column
 * @param {string[]} ids
 * @returns {Promise<number>}
 */
async function deleteIn(table, column, ids) {
  let n = 0;
  for (const part of chunk(ids)) {
    const rows = must(await admin.from(table).delete().in(column, part).select('id'), `delete ${table}`);
    n += rows.length;
  }
  return n;
}

/**
 * Remove objects from a storage bucket; failures are reported, not fatal,
 * because a missing file must never block the row delete.
 * @param {string} bucket
 * @param {string[]} paths
 * @returns {Promise<number>}
 */
async function removeFiles(bucket, paths) {
  if (!paths.length) return 0;
  let n = 0;
  for (const part of chunk(paths, 100)) {
    const { data, error } = await admin.storage.from(bucket).remove(part);
    if (error) {
      console.warn(`  ! storage ${bucket}: ${error.message}`);
      continue;
    }
    n += data?.length ?? 0;
  }
  return n;
}

// ───────────────────────── main ─────────────────────────

const shop = must(
  await admin.from('shops').select('id,company_id,name,shop_key').eq('shop_key', SHOP_KEY).eq('is_deleted', false).maybeSingle(),
  'shop',
);
if (!shop) {
  console.error(`Shop "${SHOP_KEY}" not found`);
  process.exit(1);
}

console.log(`Shop: ${shop.name} (${shop.shop_key})  Supabase: ${SUPABASE_URL}`);
console.log(`Mode: ${YES ? 'DELETE' : 'dry-run (add --yes to delete)'}`);

// Resolve --code → customer ids; --doc-prefix → document ids.
let customerIds = null;
if (filter.code) {
  const customers = must(
    await admin.from('customers').select('id,code,full_name').eq('shop_id', shop.id).eq('code', filter.code),
    'customers',
  );
  if (!customers.length) {
    console.error(`No customer with code ${filter.code}`);
    process.exit(1);
  }
  customerIds = customers.map((c) => c.id);
  console.log(`Customer ${filter.code}: ${customers.map((c) => c.full_name).join(', ')}`);
}

let docIdsByPrefix = null;
if (filter.docPrefix) {
  const docs = must(
    await admin.from('external_documents').select('id,doc_no').eq('shop_id', shop.id).like('doc_no', `${filter.docPrefix}%`),
    'documents by prefix',
  );
  docIdsByPrefix = docs.map((d) => d.id);
  console.log(`Documents with prefix ${filter.docPrefix}: ${docs.length}`);
  if (!docs.length) {
    console.log('Nothing matches. Done.');
    process.exit(0);
  }
}

// Build the booking query.
let q = admin
  .from('bookings')
  .select('id,queue_number,booking_date,start_time,status,booking_source,plate_number,do_number,document_id,customer_id,sign_staff_path,sign_customer_path')
  .eq('shop_id', shop.id)
  .order('booking_date')
  .order('start_time');
if (filter.ids.length) q = q.in('id', filter.ids);
if (filter.queues.length) q = q.in('queue_number', filter.queues);
if (filter.date) q = q.eq('booking_date', filter.date);
if (filter.from) q = q.gte('booking_date', filter.from);
if (filter.to) q = q.lte('booking_date', filter.to);
if (filter.before) q = q.lt('booking_date', filter.before);
if (filter.statuses.length) q = q.in('status', filter.statuses);
if (filter.sources.length) q = q.in('booking_source', filter.sources);
if (customerIds) q = q.in('customer_id', customerIds);
if (docIdsByPrefix) q = q.in('document_id', docIdsByPrefix);

const bookings = must(await q, 'bookings');
const bookingIds = bookings.map((b) => b.id);

if (!bookings.length) {
  console.log('No bookings match. Nothing to do.');
  if (JSON_OUT) console.log(`__DELETE_JSON__${JSON.stringify({ bookings: 0, documents: 0 })}`);
  process.exit(0);
}

// Related rows (counted up front so the dry-run shows the full blast radius).
const related = { booking_logs: 0, activity_logs: 0 };
for (const part of chunk(bookingIds)) {
  related.booking_logs += (must(await admin.from('booking_logs').select('id').in('booking_id', part), 'booking_logs')).length;
  related.activity_logs += (must(await admin.from('activity_logs').select('id').eq('target_table', 'bookings').in('target_id', part), 'activity_logs')).length;
}
const signaturePaths = bookings.flatMap((b) => [b.sign_staff_path, b.sign_customer_path]).filter(Boolean);

// Linked documents: which ones lose every booking after this delete.
const linkedDocIds = [...new Set(bookings.map((b) => b.document_id).filter(Boolean))];
let docsToRelease = [];
let docsToDelete = [];
if (linkedDocIds.length) {
  const docs = must(
    await admin.from('external_documents').select('id,doc_no,doc_type,status').in('id', linkedDocIds),
    'linked documents',
  );
  const deleting = new Set(bookingIds);
  const remaining = new Map(docs.map((d) => [d.id, 0]));
  for (const part of chunk(linkedDocIds)) {
    const others = must(await admin.from('bookings').select('id,document_id').in('document_id', part), 'other bookings of documents');
    for (const b of others) {
      if (!deleting.has(b.id)) remaining.set(b.document_id, (remaining.get(b.document_id) ?? 0) + 1);
    }
  }
  const orphaned = docs.filter((d) => (remaining.get(d.id) ?? 0) === 0);
  if (WITH_DOCS) {
    docsToDelete = orphaned;
  } else if (!KEEP_DOC_STATUS) {
    docsToRelease = orphaned.filter((d) => d.status === 'booked');
  }
}

// ── plan ──
console.log(`\nBookings to delete: ${bookings.length}`);
const preview = bookings.slice(0, 30);
for (const b of preview) {
  console.log(`  ${b.booking_date} ${String(b.start_time).slice(0, 5)}  ${b.queue_number.padEnd(20)} ${b.status.padEnd(10)} ${b.booking_source.padEnd(13)} ${b.plate_number ?? '-'}${b.do_number ? `  DO ${b.do_number}` : ''}`);
}
if (bookings.length > preview.length) console.log(`  … and ${bookings.length - preview.length} more`);

console.log('\nRelated rows:');
console.log(`  booking_logs          ${related.booking_logs}`);
console.log(`  signature files       ${signaturePaths.length}${KEEP_FILES ? '  (kept)' : ''}`);
console.log(`  activity_logs         ${related.activity_logs}  (${PURGE_LOGS ? 'deleted' : 'kept — audit trail'})`);
console.log('  booking_resource_assignments / push_subscriptions: cascade');

if (docsToDelete.length) {
  console.log(`\nDocuments to delete (--with-docs, no other booking left): ${docsToDelete.length}`);
  for (const d of docsToDelete.slice(0, 30)) console.log(`  ${d.doc_type.padEnd(4)} ${d.doc_no}  ${d.status}`);
  if (docsToDelete.length > 30) console.log(`  … and ${docsToDelete.length - 30} more`);
} else if (docsToRelease.length) {
  console.log(`\nDocuments to reset booked → open: ${docsToRelease.length}`);
  for (const d of docsToRelease.slice(0, 30)) console.log(`  ${d.doc_type.padEnd(4)} ${d.doc_no}`);
  if (docsToRelease.length > 30) console.log(`  … and ${docsToRelease.length - 30} more`);
} else if (linkedDocIds.length) {
  console.log(`\nLinked documents: ${linkedDocIds.length} (status untouched)`);
}

if (!YES) {
  console.log('\nDry-run only. Re-run with --yes to delete.');
  if (JSON_OUT) console.log(`__DELETE_JSON__${JSON.stringify({ dryRun: true, bookings: bookings.length, documents: docsToDelete.length, released: docsToRelease.length })}`);
  process.exit(0);
}

// ── execute ──
console.log('\nDeleting…');
const done = {};

// 1. Child rows without cascade.
done.booking_logs = await deleteIn('booking_logs', 'booking_id', bookingIds);
if (PURGE_LOGS) {
  let n = 0;
  for (const part of chunk(bookingIds)) {
    n += (must(await admin.from('activity_logs').delete().eq('target_table', 'bookings').in('target_id', part).select('id'), 'delete activity_logs')).length;
  }
  done.activity_logs = n;
}

// 2. Storage files (best effort).
if (!KEEP_FILES) {
  done.signature_files = await removeFiles('booking-signatures', signaturePaths);
}

// 3. The bookings themselves (cascades resource assignments and push subscriptions).
done.bookings = await deleteIn('bookings', 'id', bookingIds);

// 4. Documents: delete orphans or release them.
if (docsToDelete.length) {
  done.documents = await deleteIn('external_documents', 'id', docsToDelete.map((d) => d.id));
} else if (docsToRelease.length) {
  let n = 0;
  for (const part of chunk(docsToRelease.map((d) => d.id))) {
    n += (must(await admin.from('external_documents').update({ status: 'open' }).in('id', part).eq('status', 'booked').select('id'), 'release documents')).length;
  }
  done.documents_released = n;
}

for (const [k, v] of Object.entries(done)) console.log(`  ${k.padEnd(26)} ${v}`);
console.log('\nDone.');
if (JSON_OUT) console.log(`__DELETE_JSON__${JSON.stringify({ dryRun: false, ...done })}`);
