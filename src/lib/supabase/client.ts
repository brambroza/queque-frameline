'use client';

import { createBrowserClient } from '@supabase/ssr';
import { env } from '@/lib/utils/env';

export function createClient() {
  if (!env.supabaseUrl || env.supabaseUrl.includes('example.supabase.co')) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL in client environment');
  }
  if (!env.supabaseAnonKey || env.supabaseAnonKey.includes('placeholder')) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY in client environment');
  }

  return createBrowserClient(env.supabaseUrl, env.supabaseAnonKey);
}
