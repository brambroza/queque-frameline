#!/usr/bin/env node
/**
 * Create (or reset) a portal account for this site and grant it a role.
 *
 * Usage:
 *   node scripts/create-admin.mjs <email> <password> [fullName] [role]
 *   role = admin (default) | staff
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and SITE_SHOP_KEY
 * from .env / .env.local. The shop row (shop_key = SITE_SHOP_KEY) must already
 * exist — it is created by the seed migration.
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
  // If ws is unavailable, Supabase client may fail on Node < 22.
}

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
const SITE_SHOP_KEY = process.env.SITE_SHOP_KEY || 'fameline';

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing env: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const email = process.argv[2] || process.env.ADMIN_EMAIL;
const password = process.argv[3] || process.env.ADMIN_PASSWORD;
const fullName = process.argv[4] || process.env.ADMIN_NAME || 'Site Admin';
const roleCode = process.argv[5] || process.env.ADMIN_ROLE || 'admin';

if (!email || !password) {
  console.error('Usage: node scripts/create-admin.mjs <email> <password> [fullName] [roleCode]');
  process.exit(1);
}
// Any code in public.roles works (admin, staff, or a role created from the staff screen).
if (!/^[a-z][a-z0-9_]{1,31}$/.test(roleCode)) {
  console.error(`Invalid role code "${roleCode}" — use a-z, 0-9, _ (e.g. admin, staff)`);
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
  realtime: { transport: globalThis.WebSocket },
});

async function findUserByEmail(targetEmail) {
  let page = 1;
  const perPage = 200;
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const users = data?.users ?? [];
    const found = users.find((u) => (u.email || '').toLowerCase() === targetEmail.toLowerCase());
    if (found) return found;
    if (users.length < perPage) return null;
    page += 1;
  }
}

async function main() {
  const { data: shop, error: shopErr } = await admin
    .from('shops')
    .select('id, company_id, name')
    .eq('shop_key', SITE_SHOP_KEY)
    .eq('is_deleted', false)
    .maybeSingle();
  if (shopErr) throw shopErr;
  if (!shop) throw new Error(`Site shop "${SITE_SHOP_KEY}" not found. Apply supabase/migrations first (seed creates it).`);

  const { data: roleRow, error: roleErr } = await admin.from('roles').select('id').eq('code', roleCode).single();
  if (roleErr || !roleRow) throw new Error(`Role ${roleCode} not found. Apply the seed migration first.`);

  let user = await findUserByEmail(email);
  if (!user) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });
    if (error || !data.user) throw error || new Error('Failed to create auth user');
    user = data.user;
    console.log(`Created auth user: ${user.id}`);
  } else {
    console.log(`Auth user already exists: ${user.id}`);
    const { error: updateError } = await admin.auth.admin.updateUserById(user.id, {
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });
    if (updateError) throw updateError;
    console.log('Updated existing user password/profile');
  }

  const userId = user.id;

  const { error: profileErr } = await admin.from('users_profile').upsert({
    id: userId,
    company_id: shop.company_id,
    shop_id: shop.id,
    full_name: fullName,
    email,
    active: true,
    created_by: userId,
    updated_by: userId,
  });
  if (profileErr) throw profileErr;

  const { data: existingUserRole, error: existingRoleErr } = await admin
    .from('user_roles')
    .select('id, is_deleted')
    .eq('user_id', userId)
    .eq('role_id', roleRow.id)
    .eq('shop_id', shop.id)
    .maybeSingle();
  if (existingRoleErr) throw existingRoleErr;

  if (!existingUserRole) {
    const { error: userRoleErr } = await admin.from('user_roles').insert({
      user_id: userId,
      role_id: roleRow.id,
      company_id: shop.company_id,
      shop_id: shop.id,
      created_by: userId,
      updated_by: userId,
    });
    if (userRoleErr) throw userRoleErr;
    console.log(`Assigned role: ${roleCode} @ ${shop.name}`);
  } else if (existingUserRole.is_deleted) {
    const { error: reviveErr } = await admin.from('user_roles').update({ is_deleted: false, updated_by: userId }).eq('id', existingUserRole.id);
    if (reviveErr) throw reviveErr;
    console.log(`Re-enabled role: ${roleCode} @ ${shop.name}`);
  } else {
    console.log(`Role ${roleCode} already assigned @ ${shop.name}`);
  }

  console.log('Done.');
}

main().catch((err) => {
  console.error('Failed:', err?.message || err);
  process.exit(1);
});
