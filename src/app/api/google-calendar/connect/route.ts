import { randomBytes } from 'crypto';
import { NextResponse } from 'next/server';
import { requireAuthContext, getErrorStatus } from '@/lib/auth/context';
import {
  getGoogleOAuthCredentials,
  getGoogleOAuthPlatformConfig,
  GOOGLE_CALENDAR_SCOPE,
  GOOGLE_OAUTH_STATE_COOKIE,
} from '@/lib/google-calendar/oauth';

function settingsRedirect(origin: string, result: string) {
  const url = new URL('/portal/settings', origin);
  url.searchParams.set('google_calendar', result);
  url.hash = 'google-calendar';
  return url;
}

export async function GET(req: Request) {
  try {
    const { profile } = await requireAuthContext({ roles: ['super_admin', 'shop_owner', 'branch_manager'] });
    const origin = new URL(req.url).origin;
    const redirectUri = `${origin}/api/google-calendar/callback`;
    if (!getGoogleOAuthPlatformConfig().configured) {
      return NextResponse.redirect(settingsRedirect(origin, 'not_configured'));
    }
    const credentials = getGoogleOAuthCredentials();

    const state = Buffer.from(JSON.stringify({
      shopId: profile.shop_id,
      nonce: randomBytes(32).toString('base64url'),
    })).toString('base64url');
    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.set('client_id', credentials.clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', GOOGLE_CALENDAR_SCOPE);
    authUrl.searchParams.set('access_type', 'offline');
    authUrl.searchParams.set('prompt', 'select_account consent');
    authUrl.searchParams.set('state', state);

    const response = NextResponse.redirect(authUrl);
    response.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, state, {
      httpOnly: true,
      sameSite: 'lax',
      secure: origin.startsWith('https://'),
      path: '/api/google-calendar',
      maxAge: 10 * 60,
    });
    return response;
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to connect Google Calendar' },
      { status: getErrorStatus(error) },
    );
  }
}
