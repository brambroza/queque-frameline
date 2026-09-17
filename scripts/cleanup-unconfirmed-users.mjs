#!/usr/bin/env node
/**
 * Find (and optionally delete) auth users who never confirmed their email.
 *
 * Default is a dry-run report. Nothing is deleted unless `--delete` is passed.
 *
 * Usage:
 *   node scripts/cleanup-unconfirmed-users.mjs                 # report only
 *   node scripts/cleanup-unconfirmed-users.mjs --older-than=7  # only signups older than 7 days
 *   node scripts/cleanup-unconfirmed-users.mjs --email=a@b.c   # single user
 *   node scripts/cleanup-unconfirmed-users.mjs --delete        # actually delete
 *   node scripts/cleanup-unconfirmed-users.mjs --delete --force  # delete even if the shop has bookings
 *   node scripts/cleanup-unconfirmed-users.mjs --json          # machine-readable report
 *
 * What gets deleted per user (only with --delete):
 *   - Always: the user's own rows (user_roles, users_profile, staff, notifications,
 *     activity_logs) and the auth user itself.
 *   - When the user is the ONLY member of their company: the whole tenant created
 *     by /api/auth/register (shop, branches, services, working hours, subscription,
 *     upgrade requests, seed data, ...) in FK-safe order.
 *   - Users with the super_admin role are never touched.
 *   - A shop that already has bookings is skipped unless --force is passed.
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
  // ws optional on Node >= 22
}

/**
 * Load KEY=VALUE pairs from an env file without overriding existing env.
 * @param {string} filePath
 */
function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf8');
  for (const rawLine of content.split('\n')) {
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

/**
 * Parse CLI flags of the form --key or --key=value.
 * @param {string[]} argv
 * @returns {{ delete: boolean, force: boolean, json: boolean, olderThanDays: number, email: string | null }}
 */
function parseArgs(argv) {
  const opts = { delete: false, force: false, json: false, olderThanDays: 1, email: null };
  for (const arg of argv) {
    if (arg === '--delete') opts.delete = true;
    else if (arg === '--force') opts.force = true;
    else if (arg === '--json') opts.json = true;
    else if (arg.startsWith('--older-than=')) {
      const n = Number(arg.slice('--older-than='.length));
      if (!Number.isFinite(n) || n < 0) {
        console.error('--older-than must be a non-negative number of days');
        process.exit(1);
      }
      opts.olderThanDays = n;
    } else if (arg.startsWith('--email=')) {
      opts.email = arg.slice('--email='.length).trim().toLowerCase() || null;
    } else {
      console.error(`Unknown argument: ${arg}`);
      process.exit(1);
    }
  }
  return opts;
}

const opts = parseArgs(process.argv.slice(2));

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
  realtime: { transport: globalThis.WebSocket },
});

/**
 * Tables scoped by shop_id + company_id, in FK-safe delete order (children first).
 * Missing tables (migration not applied yet) are skipped with a warning.
 */
const SHOP_SCOPED_TABLES = [
  // booking children
  'payment_slips',
  'payment_transactions',
  'booking_calendar_events',
  'booking_logs',
  'booking_resource_assignments',
  'demo_chat_messages',
  'notifications',
  'upgrade_requests',
  'bookings',
  // shop-level
  'queue_slots',
  'line_messages',
  'customers',
  'line_users',
  'holidays',
  'working_hours',
  'signage_settings',
  'booking_resources',
  'staff_branches',
  'staff',
  'services',
  'service_categories',
  'settings',
  'google_calendar_connections',
  'demo_sandbox_sessions',
  'activity_logs',
  'shop_bank_deeplink_providers',
  'shop_subscriptions',
  'branches',
  'user_roles',
  'users_profile',
];

/** Tables holding rows keyed by auth user id (column name per table). */
const USER_SCOPED_TABLES = [
  ['staff_branches', null], // handled via staff below
  ['staff', 'user_id'],
  ['user_roles', 'user_id'],
  ['notifications', 'user_id'],
  ['activity_logs', 'user_id'],
  ['users_profile', 'id'],
];

/**
 * Fetch every auth user via paginated admin API.
 * @returns {Promise<import('@supabase/supabase-js').User[]>}
 */
async function listAllUsers() {
  const all = [];
  let page = 1;
  const perPage = 200;
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const users = data?.users ?? [];
    all.push(...users);
    if (users.length < perPage) break;
    page += 1;
  }
  return all;
}

/**
 * @param {import('@supabase/supabase-js').User} u
 */
function isUnconfirmed(u) {
  return !u.email_confirmed_at && !u.confirmed_at && !u.phone_confirmed_at;
}

/**
 * Count rows matching a filter; returns 0 when the table does not exist.
 * @param {string} table
 * @param {Record<string, unknown>} match
 */
async function countRows(table, match) {
  const { count, error } = await admin.from(table).select('*', { count: 'exact', head: true }).match(match);
  if (error) {
    if (error.code === '42P01') return 0;
    throw new Error(`${table} count failed: ${error.message}`);
  }
  return count ?? 0;
}

/**
 * Delete rows matching a filter; tolerates missing tables.
 * @param {string} table
 * @param {Record<string, unknown>} match
 * @param {string[]} warnings
 */
async function deleteRows(table, match, warnings) {
  const { error } = await admin.from(table).delete().match(match);
  if (error) {
    if (error.code === '42P01') {
      warnings.push(`table ${table} missing, skipped`);
      return;
    }
    throw new Error(`${table} delete failed: ${error.message}`);
  }
}

/**
 * Build a report entry for one unconfirmed user: tenant info + safety checks.
 * @param {import('@supabase/supabase-js').User} user
 * @param {Set<string>} superAdminIds
 */
async function inspectUser(user, superAdminIds) {
  const userId = user.id;
  const entry = {
    user_id: userId,
    email: user.email ?? null,
    created_at: user.created_at,
    age_days: Math.floor((Date.now() - new Date(user.created_at).getTime()) / 86_400_000),
    company_id: null,
    shop_id: null,
    shop_name: null,
    sole_member: false,
    bookings: 0,
    action: 'skip',
    reason: '',
  };

  if (superAdminIds.has(userId)) {
    entry.reason = 'super_admin role';
    return entry;
  }
  if (user.last_sign_in_at) {
    entry.reason = 'has signed in';
    return entry;
  }
  if (entry.age_days < opts.olderThanDays) {
    entry.reason = `younger than ${opts.olderThanDays} day(s)`;
    return entry;
  }

  const { data: profile, error: profileErr } = await admin
    .from('users_profile')
    .select('company_id, shop_id')
    .eq('id', userId)
    .maybeSingle();
  if (profileErr) throw new Error(`users_profile lookup failed: ${profileErr.message}`);

  entry.company_id = profile?.company_id ?? null;
  entry.shop_id = profile?.shop_id ?? null;

  if (!entry.company_id) {
    entry.action = 'delete_user_only';
    entry.reason = 'no tenant attached';
    return entry;
  }

  const [otherProfiles, otherRoles, otherStaff, shopRow] = await Promise.all([
    admin.from('users_profile').select('id', { count: 'exact', head: true }).eq('company_id', entry.company_id).neq('id', userId),
    admin.from('user_roles').select('id', { count: 'exact', head: true }).eq('company_id', entry.company_id).neq('user_id', userId),
    admin.from('staff').select('id', { count: 'exact', head: true }).eq('company_id', entry.company_id).neq('user_id', userId),
    entry.shop_id ? admin.from('shops').select('name').eq('id', entry.shop_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
  ]);
  for (const r of [otherProfiles, otherRoles, otherStaff, shopRow]) {
    if (r.error) throw new Error(`tenant check failed: ${r.error.message}`);
  }
  entry.shop_name = shopRow.data?.name ?? null;
  entry.sole_member = (otherProfiles.count ?? 0) === 0 && (otherRoles.count ?? 0) === 0 && (otherStaff.count ?? 0) === 0;

  if (!entry.sole_member) {
    entry.action = 'delete_user_only';
    entry.reason = 'company has other members, tenant kept';
    return entry;
  }

  entry.bookings = await countRows('bookings', { company_id: entry.company_id });
  if (entry.bookings > 0 && !opts.force) {
    entry.reason = `shop has ${entry.bookings} booking(s); pass --force to delete anyway`;
    return entry;
  }

  entry.action = 'delete_tenant';
  entry.reason = entry.bookings > 0 ? 'forced: tenant with bookings' : 'sole member, empty tenant';
  return entry;
}

/**
 * Delete only rows owned by the user, then the auth user. Tenant is kept.
 * @param {ReturnType<typeof inspectUser> extends Promise<infer T> ? T : never} entry
 * @param {string[]} warnings
 */
async function deleteUserOnly(entry, warnings) {
  const { data: staffRows, error: staffErr } = await admin.from('staff').select('id').eq('user_id', entry.user_id);
  if (staffErr && staffErr.code !== '42P01') throw new Error(`staff lookup failed: ${staffErr.message}`);
  for (const s of staffRows ?? []) {
    await deleteRows('staff_branches', { staff_id: s.id }, warnings);
  }
  for (const [table, column] of USER_SCOPED_TABLES) {
    if (!column) continue;
    await deleteRows(table, { [column]: entry.user_id }, warnings);
  }
  const { error } = await admin.auth.admin.deleteUser(entry.user_id);
  if (error) throw new Error(`auth delete failed: ${error.message}`);
}

/**
 * Delete the whole tenant (shop + company) and the auth user, children first.
 * @param {ReturnType<typeof inspectUser> extends Promise<infer T> ? T : never} entry
 * @param {string[]} warnings
 */
async function deleteTenant(entry, warnings) {
  for (const table of SHOP_SCOPED_TABLES) {
    if (entry.shop_id) await deleteRows(table, { shop_id: entry.shop_id }, warnings);
    await deleteRows(table, { company_id: entry.company_id }, warnings);
  }
  // rows keyed by user but possibly outside the tenant scope
  await deleteRows('notifications', { user_id: entry.user_id }, warnings);
  await deleteRows('activity_logs', { user_id: entry.user_id }, warnings);
  await deleteRows('user_roles', { user_id: entry.user_id }, warnings);
  await deleteRows('users_profile', { id: entry.user_id }, warnings);

  if (entry.shop_id) await deleteRows('shops', { id: entry.shop_id }, warnings);
  await deleteRows('shops', { company_id: entry.company_id }, warnings);
  await deleteRows('companies', { id: entry.company_id }, warnings);

  const { error } = await admin.auth.admin.deleteUser(entry.user_id);
  if (error) throw new Error(`auth delete failed: ${error.message}`);
}

async function main() {
  const [users, { data: superRole, error: roleErr }] = await Promise.all([
    listAllUsers(),
    admin.from('roles').select('id').eq('code', 'super_admin').maybeSingle(),
  ]);
  if (roleErr) throw new Error(`roles lookup failed: ${roleErr.message}`);

  const superAdminIds = new Set();
  if (superRole?.id) {
    const { data: rows, error } = await admin.from('user_roles').select('user_id').eq('role_id', superRole.id);
    if (error) throw new Error(`super_admin lookup failed: ${error.message}`);
    for (const r of rows ?? []) superAdminIds.add(r.user_id);
  }

  let candidates = users.filter(isUnconfirmed);
  if (opts.email) candidates = candidates.filter((u) => (u.email ?? '').toLowerCase() === opts.email);
  candidates.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  const report = [];
  for (const u of candidates) {
    report.push(await inspectUser(u, superAdminIds));
  }

  const summary = {
    total_users: users.length,
    unconfirmed: candidates.length,
    to_delete: report.filter((r) => r.action !== 'skip').length,
    skipped: report.filter((r) => r.action === 'skip').length,
    mode: opts.delete ? 'DELETE' : 'DRY-RUN',
  };

  if (opts.json && !opts.delete) {
    console.log(JSON.stringify({ summary, users: report }, null, 2));
    return;
  }

  console.log(`Mode: ${summary.mode} | total users: ${summary.total_users} | unconfirmed: ${summary.unconfirmed} | to delete: ${summary.to_delete} | skipped: ${summary.skipped}`);
  if (report.length) {
    console.table(
      report.map((r) => ({
        email: r.email,
        created: r.created_at?.slice(0, 10),
        days: r.age_days,
        shop: r.shop_name ?? '-',
        bookings: r.bookings,
        action: r.action,
        reason: r.reason,
      }))
    );
  }

  if (!opts.delete) {
    console.log('Dry-run only. Re-run with --delete to remove the rows marked delete_user_only / delete_tenant.');
    return;
  }

  const results = [];
  for (const entry of report) {
    if (entry.action === 'skip') continue;
    const warnings = [];
    try {
      if (entry.action === 'delete_tenant') await deleteTenant(entry, warnings);
      else await deleteUserOnly(entry, warnings);
      results.push({ email: entry.email, action: entry.action, ok: true, warnings });
      console.log(`deleted ${entry.email} (${entry.action})${warnings.length ? ` warnings: ${warnings.join('; ')}` : ''}`);
    } catch (err) {
      results.push({ email: entry.email, action: entry.action, ok: false, error: err?.message ?? String(err) });
      console.error(`FAILED ${entry.email}: ${err?.message ?? err}`);
    }
  }

  const failed = results.filter((r) => !r.ok).length;
  console.log(`Done. deleted: ${results.length - failed}, failed: ${failed}`);
  if (opts.json) console.log(JSON.stringify({ summary, results }, null, 2));
  if (failed) process.exit(1);
}

main().catch((err) => {
  console.error('Failed:', err?.message || err);
  process.exit(1);
});
