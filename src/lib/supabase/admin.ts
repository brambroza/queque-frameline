import { createClient } from '@supabase/supabase-js';
import { env } from '@/lib/utils/env';

export function createAdminClient() {
  if (!env.supabaseUrl || env.supabaseUrl.includes('example.supabase.co')) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL in environment');
  }
  if (!env.supabaseServiceRoleKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY in environment');
  }

  return createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
