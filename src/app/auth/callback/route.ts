import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { env } from '@/lib/utils/env';

/**
 * Landing point for Supabase email links (invite, password recovery, magic link).
 * Exchanges the one-time `code` for a session cookie, then sends the user on to
 * `next` (default: set a password). Only same-site paths are honoured.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const rawNext = url.searchParams.get('next') ?? '/set-password';
  const next = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/set-password';

  if (!code) return NextResponse.redirect(new URL(`/login?error=invalid_link`, url.origin));

  const response = NextResponse.redirect(new URL(next, url.origin));
  const cookieStore = await cookies();
  const supabase = createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (list: Array<{ name: string; value: string; options?: Record<string, unknown> }>) => {
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(new URL(`/login?error=link_expired`, url.origin));
  return response;
}
