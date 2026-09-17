const fs = require('fs');
const ws = require('ws');
global.WebSocket = ws;
const { createClient } = require('@supabase/supabase-js');

const env = fs.readFileSync('.env', 'utf8');
const get = (k) => {
  const m = env.match(new RegExp('^' + k + '=(.*)$', 'm'));
  return m ? m[1].trim().replace(/^\"|\"$/g, '') : '';
};

const url = get('NEXT_PUBLIC_SUPABASE_URL');
const key = get('SUPABASE_SERVICE_ROLE_KEY');
const email = process.argv[2];
if (!email) {
  console.log('Usage: node scripts/check-user-context.js <email>');
  process.exit(1);
}

const admin = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
  realtime: { transport: ws },
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

(async () => {
  const user = await findUserByEmail(email);
  if (!user) {
    console.log(JSON.stringify({ email, found: false }, null, 2));
    return;
  }

  const userId = user.id;
  const [{ data: profile }, { data: userRoles }, { data: roles }] = await Promise.all([
    admin.from('users_profile').select('*').eq('id', userId).maybeSingle(),
    admin.from('user_roles').select('*').eq('user_id', userId).eq('is_deleted', false),
    admin.from('roles').select('id,code,name').eq('is_deleted', false),
  ]);

  const roleMap = new Map((roles ?? []).map((r) => [r.id, r.code]));
  const decorated = (userRoles ?? []).map((ur) => ({
    id: ur.id,
    role_id: ur.role_id,
    role_code: roleMap.get(ur.role_id) || null,
    company_id: ur.company_id,
    shop_id: ur.shop_id,
  }));

  console.log(
    JSON.stringify(
      {
        email,
        found: true,
        user_id: userId,
        profile,
        roles: decorated,
      },
      null,
      2,
    ),
  );
})();
