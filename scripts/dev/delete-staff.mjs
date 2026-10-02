#!/usr/bin/env node
/**
 * Hard-delete staff members of the shop together with their login (auth.users).
 *
 * The portal only soft-deletes staff (`staff.is_deleted`, grants revoked), so the
 * auth account, profile and old rows stay behind. Use this to really remove an
 * account — e.g. a mistyped invite, a test user, or someone who must be invited
 * again from scratch. It can run against production, which is why it is
 * dry-run by default and refuses to touch anything without `--yes`.
 *
 * Usage:
 *   node scripts/dev/delete-staff.mjs <target...> [options]
 *
 * Targets (at least one; lists are comma separated, all combine with OR):
 *   --email=<email>[,<email>...]     login email (case-insensitive)
 *   --user-id=<uuid>[,<uuid>...]     auth user id
 *   --staff-id=<uuid>[,<uuid>...]    staff row id (as shown in activity logs)
 *
 * Options:
 *   --shop=<shop_key>  shop to work on (default SITE_SHOP_KEY from .env)
 *   --keep-auth        remove the shop rows only; keep the auth.users login
 *   --purge-logs       delete the user's activity_logs rows
 *                      (default: keep them and set user_id = null — audit trail stays)
 *   --force            allow deleting the last admin-level user of the shop
 *   --yes              actually delete. Without it the script only prints the plan.
 *
 * Examples:
 *   node scripts/dev/delete-staff.mjs --email=someone@fameline.com              # plan only
 *   node scripts/dev/delete-staff.mjs --email=someone@fameline.com --yes        # do it
 *   node scripts/dev/delete-staff.mjs --email=a@x.com,b@x.com --keep-auth --yes
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and SITE_SHOP_KEY
 * from .env / .env.local (same as delete-bookings.mjs).
 *
 * What gets removed per user (every table with an FK to auth.users / staff):
 *   staff_branches → staff → user_roles → notifications → activity_logs
 *   (null-out or purge) → users_profile → auth.users.
 * Left alone on purpose: created_by / updated_by on other rows (no FK, they keep
 * the old uuid), booking_logs, feedback_reports (store names, not FKs).
 * A user whose profile belongs to another shop is skipped.
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

const KNOWN = new Set(['email', 'user-id', 'staff-id', 'shop', 'keep-auth', 'purge-logs', 'force', 'yes', 'help']);
const unknown = Object.keys(args).filter((k) => !KNOWN.has(k));
if (unknown.length || args.help) {
  if (unknown.length) console.error(`Unknown option(s): ${unknown.join(', ')}`);
  console.error('See the header of scripts/dev/delete-staff.mjs for usage.');
  process.exit(unknown.length ? 1 : 0);
}

const SHOP_KEY = String(args.shop || process.env.SITE_SHOP_KEY || 'fameline');
const YES = args.yes === true;
const KEEP_AUTH = args['keep-auth'] === true;
const PURGE_LOGS = args['purge-logs'] === true;
const FORCE = args.force === true;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Split a comma list option into trimmed, non-empty strings.
 * @param {unknown} v
 * @returns {string[]}
 */
function list(v) {
  if (typeof v !== 'string') return [];
  return v.split(',').map((s) => s.trim()).filter(Boolean);
}

const target = {
  emails: list(args.email).map((e) => e.toLowerCase()),
  userIds: list(args['user-id']),
  staffIds: list(args['staff-id']),
};
if (!target.emails.length && !target.userIds.length && !target.staffIds.length) {
  console.error('Refusing to run without a target. Pass --email, --user-id or --staff-id.');
  process.exit(1);
}
const badEmail = target.emails.filter((e) => !EMAIL_RE.test(e));
const badUuid = [...target.userIds, ...target.staffIds].filter((id) => !UUID_RE.test(id));
if (badEmail.length || badUuid.length) {
  console.error(`Malformed value(s): ${[...badEmail, ...badUuid].join(', ')}`);
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
 * Every auth user, paged (auth.users is not reachable through PostgREST).
 * @returns {Promise<Array<{ id: string, email?: string, created_at: string, last_sign_in_at?: string | null }>>}
 */
async function listAuthUsers() {
  const out = [];
  for (let page = 1; page <= 50; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) {
      console.error(`✗ auth users: ${error.message}`);
      process.exit(1);
    }
    out.push(...data.users);
    if (data.users.length < 200) break;
  }
  return out;
}

/**
 * Count rows of `table` where `column` = `value`.
 * @param {string} table
 * @param {string} column
 * @param {string} value
 * @returns {Promise<number>}
 */
async function countWhere(table, column, value) {
  const { count, error } = await admin.from(table).select('id', { count: 'exact', head: true }).eq(column, value);
  if (error) {
    console.error(`✗ count ${table}: ${error.message}`);
    process.exit(1);
  }
  return count ?? 0;
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
console.log(`Mode: ${YES ? 'DELETE' : 'dry-run (add --yes to delete)'}${KEEP_AUTH ? '  · keep auth login' : ''}`);

// Resolve every target to an auth user id.
const authUsers = await listAuthUsers();
const authById = new Map(authUsers.map((u) => [u.id, u]));
const wanted = new Set(target.userIds);
const missing = [];

for (const email of target.emails) {
  const u = authUsers.find((x) => (x.email ?? '').toLowerCase() === email);
  if (u) wanted.add(u.id);
  else missing.push(email);
}
if (target.staffIds.length) {
  const rows = must(await admin.from('staff').select('id,user_id').eq('shop_id', shop.id).in('id', target.staffIds), 'staff by id');
  for (const id of target.staffIds) {
    const row = rows.find((r) => r.id === id);
    if (row) wanted.add(row.user_id);
    else missing.push(`staff ${id}`);
  }
}
for (const id of target.userIds) {
  if (!authById.has(id)) {
    // A profile/staff row may outlive its auth user; still clean those up.
    const profile = must(await admin.from('users_profile').select('id').eq('id', id).maybeSingle(), 'profile');
    if (!profile) {
      wanted.delete(id);
      missing.push(`user ${id}`);
    }
  }
}
if (missing.length) console.log(`Not found: ${missing.join(', ')}`);
if (!wanted.size) {
  console.log('Nothing to do.');
  process.exit(0);
}

// Admin-level users of the shop, to avoid locking the site out.
const adminGrants = must(
  await admin.from('user_roles').select('user_id, roles!inner(access_level,is_deleted)')
    .eq('shop_id', shop.id).eq('is_deleted', false).eq('roles.access_level', 'admin').eq('roles.is_deleted', false),
  'admin grants',
);
const adminUserIds = new Set(adminGrants.map((g) => g.user_id));

const plans = [];
for (const userId of wanted) {
  const auth = authById.get(userId) ?? null;
  const profile = must(await admin.from('users_profile').select('id,shop_id,full_name,email').eq('id', userId).maybeSingle(), 'profile');
  const label = auth?.email ?? profile?.email ?? userId;

  if (profile?.shop_id && profile.shop_id !== shop.id) {
    console.log(`Skip ${label}: profile belongs to another shop`);
    continue;
  }

  const staffRows = must(await admin.from('staff').select('id,display_name,is_deleted').eq('user_id', userId), 'staff');
  const staffIds = staffRows.map((s) => s.id);
  const staffBranches = staffIds.length
    ? must(await admin.from('staff_branches').select('id').in('staff_id', staffIds), 'staff_branches').length
    : 0;

  plans.push({
    userId,
    label,
    name: profile?.full_name ?? staffRows[0]?.display_name ?? '-',
    auth,
    hasProfile: Boolean(profile),
    staffIds,
    staffActive: staffRows.filter((s) => !s.is_deleted).length,
    staffBranches,
    userRoles: await countWhere('user_roles', 'user_id', userId),
    notifications: await countWhere('notifications', 'user_id', userId),
    activityLogs: await countWhere('activity_logs', 'user_id', userId),
    isAdmin: adminUserIds.has(userId),
  });
}

if (!plans.length) {
  console.log('Nothing to do.');
  process.exit(0);
}

const adminsLeft = [...adminUserIds].filter((id) => !plans.some((p) => p.userId === id)).length;
if (adminsLeft === 0 && plans.some((p) => p.isAdmin) && !FORCE) {
  console.error('\nRefusing: this would remove every admin-level user of the shop. Pass --force if that is really intended.');
  process.exit(1);
}

// ── plan ──
console.log(`\nUsers to delete: ${plans.length}`);
for (const p of plans) {
  const login = p.auth
    ? `login created ${p.auth.created_at.slice(0, 10)}, last sign-in ${p.auth.last_sign_in_at?.slice(0, 10) ?? 'never'}`
    : 'no auth user';
  console.log(`\n  ${p.label}  (${p.name})${p.isAdmin ? '  [ADMIN]' : ''}`);
  console.log(`    ${login}`);
  console.log(`    staff rows ${p.staffIds.length} (${p.staffActive} active) · staff_branches ${p.staffBranches} · user_roles ${p.userRoles}`);
  console.log(`    notifications ${p.notifications} · activity_logs ${p.activityLogs} (${PURGE_LOGS ? 'deleted' : 'kept, user_id → null'})`);
  console.log(`    users_profile ${p.hasProfile ? 1 : 0} · auth.users ${p.auth ? (KEEP_AUTH ? 'kept' : 1) : 0}`);
}

if (!YES) {
  console.log('\nDry-run only. Re-run with --yes to delete.');
  process.exit(0);
}

// ── execute ──
console.log('\nDeleting…');
for (const p of plans) {
  if (p.staffIds.length) {
    must(await admin.from('staff_branches').delete().in('staff_id', p.staffIds), 'delete staff_branches');
    must(await admin.from('staff').delete().in('id', p.staffIds), 'delete staff');
  }
  must(await admin.from('user_roles').delete().eq('user_id', p.userId), 'delete user_roles');
  must(await admin.from('notifications').delete().eq('user_id', p.userId), 'delete notifications');
  if (PURGE_LOGS) {
    must(await admin.from('activity_logs').delete().eq('user_id', p.userId), 'delete activity_logs');
  } else if (!KEEP_AUTH) {
    // The FK to auth.users would block the delete; keep the rows, drop the link.
    must(await admin.from('activity_logs').update({ user_id: null }).eq('user_id', p.userId), 'detach activity_logs');
  }
  if (!KEEP_AUTH || !p.auth) {
    must(await admin.from('users_profile').delete().eq('id', p.userId), 'delete users_profile');
  }
  if (p.auth && !KEEP_AUTH) {
    const { error } = await admin.auth.admin.deleteUser(p.userId);
    if (error) {
      console.error(`✗ delete auth user ${p.label}: ${error.message}`);
      process.exit(1);
    }
  }
  console.log(`  ✓ ${p.label}`);
}
console.log('\nDone.');
