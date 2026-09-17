const fs = require('fs');
const ws = require('ws');
global.WebSocket = ws;
const { createClient } = require('@supabase/supabase-js');

const c = fs.readFileSync('.env', 'utf8');
const g = (k) => {
  const m = c.match(new RegExp('^' + k + '=(.*)$', 'm'));
  return m ? m[1].trim().replace(/^\"|\"$/g, '') : '';
};

const url = g('NEXT_PUBLIC_SUPABASE_URL');
const key = g('SUPABASE_SERVICE_ROLE_KEY');
const admin = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
  realtime: { transport: ws },
});

(async () => {
  let page = 1;
  const perPage = 200;
  let user = null;

  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const arr = data?.users || [];
    user = arr.find((u) => (u.email || '').toLowerCase() === 'amnart.gl@gmail.com');
    if (user || arr.length < perPage) break;
    page += 1;
  }

  if (!user) {
    console.log('USER_NOT_FOUND');
    return;
  }

  const r = await admin.auth.admin.updateUserById(user.id, {
    password: '1234@pass',
    email_confirm: true,
    user_metadata: { full_name: 'super admin' },
  });

  if (r.error) {
    console.log('UPDATE_ERROR', r.error.message);
    return;
  }

  console.log('PASSWORD_UPDATED', user.id);
})();
