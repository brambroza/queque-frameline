import { timingSafeEqual } from 'crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { requireAuthContext } from '@/lib/auth/context';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  encryptGoogleToken,
  exchangeGoogleAuthorizationCode,
  getGoogleOAuthCredentials,
  GOOGLE_OAUTH_STATE_COOKIE,
} from '@/lib/google-calendar/oauth';

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function shopIdFromState(state: string) {
  try {
    const payload = JSON.parse(Buffer.from(state, 'base64url').toString('utf8')) as { shopId?: unknown };
    return typeof payload.shopId === 'string' ? payload.shopId : null;
  } catch {
    return null;
  }
}

function redirectResult(origin: string, result: string) {
  const url = new URL('/portal/settings', origin);
  url.searchParams.set('google_calendar', result);
  url.hash = 'google-calendar';
  const response = NextResponse.redirect(url);
  response.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: url.protocol === 'https:',
    path: '/api/google-calendar',
    maxAge: 0,
  });
  return response;
}

export async function GET(req: Request) {
  const origin = new URL(req.url).origin;
  try {
    const { searchParams } = new URL(req.url);
    if (searchParams.get('error')) return redirectResult(origin, 'denied');

    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const cookieStore = await cookies();
    const expectedState = cookieStore.get(GOOGLE_OAUTH_STATE_COOKIE)?.value;
    if (!code || !state || !expectedState || !safeEqual(state, expectedState)) {
      return redirectResult(origin, 'invalid_state');
    }

    const { user, profile } = await requireAuthContext({
      roles: ['super_admin', 'shop_owner', 'branch_manager'],
    });
    const stateShopId = shopIdFromState(state);
    if (!stateShopId || stateShopId !== profile.shop_id) return redirectResult(origin, 'invalid_state');
    const credentials = getGoogleOAuthCredentials();
    const redirectUri = `${origin}/api/google-calendar/callback`;
    const tokens = await exchangeGoogleAuthorizationCode(code, credentials, redirectUri);
    const admin = createAdminClient();
    const { data: existing } = await admin
      .from('google_calendar_connections')
      .select('refresh_token_encrypted')
      .eq('company_id', profile.company_id)
      .eq('shop_id', profile.shop_id)
      .maybeSingle();
    const refreshTokenEncrypted = tokens.refresh_token
      ? encryptGoogleToken(tokens.refresh_token)
      : existing?.refresh_token_encrypted;
    if (!refreshTokenEncrypted) return redirectResult(origin, 'missing_refresh_token');

    const expiresAt = new Date(Date.now() + Math.max(tokens.expires_in ?? 3600, 60) * 1000).toISOString();
    const { error } = await admin
      .from('google_calendar_connections')
      .upsert({
        company_id: profile.company_id,
        shop_id: profile.shop_id,
        calendar_id: 'primary',
        access_token_encrypted: encryptGoogleToken(tokens.access_token!),
        refresh_token_encrypted: refreshTokenEncrypted,
        token_expires_at: expiresAt,
        granted_scope: tokens.scope ?? null,
        connected_by: user.id,
        last_error: null,
        created_by: user.id,
        updated_by: user.id,
      }, { onConflict: 'shop_id' });
    if (error) throw error;

    return redirectResult(origin, 'connected');
  } catch (error) {
    console.error('[Google Calendar] OAuth callback failed:', error instanceof Error ? error.message : error);
    return redirectResult(origin, 'error');
  }
}
