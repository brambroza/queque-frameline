import 'server-only';

import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { env } from '@/lib/utils/env';

export const GOOGLE_CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.events.owned';
export const GOOGLE_OAUTH_STATE_COOKIE = 'queue_google_calendar_oauth_state';

export type GoogleCalendarConnection = {
  id: string;
  company_id: string;
  shop_id: string;
  calendar_id: string;
  access_token_encrypted: string;
  refresh_token_encrypted: string;
  token_expires_at: string | null;
};

export type GoogleOAuthCredentials = {
  clientId: string;
  clientSecret: string;
};

type GoogleTokenResponse = {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  error?: string;
};

export function getGoogleOAuthPlatformConfig() {
  const encryptionSeed = env.googleTokenEncryptionKey || env.supabaseServiceRoleKey;
  return {
    clientId: env.googleOAuthClientId,
    clientSecret: env.googleOAuthClientSecret,
    encryptionSeed,
    configured: Boolean(env.googleOAuthClientId && env.googleOAuthClientSecret && encryptionSeed),
  };
}

function encryptionKeys() {
  const seeds = [env.googleTokenEncryptionKey, env.supabaseServiceRoleKey].filter(Boolean);
  const uniqueSeeds = Array.from(new Set(seeds));
  if (uniqueSeeds.length === 0) throw new Error('Google Calendar token encryption is not configured');
  return uniqueSeeds.map((seed) => createHash('sha256').update(seed, 'utf8').digest());
}

export function encryptGoogleToken(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKeys()[0], iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString('base64url')}.${tag.toString('base64url')}.${encrypted.toString('base64url')}`;
}

export function decryptGoogleToken(value: string) {
  const [version, ivText, tagText, encryptedText] = value.split('.');
  if (version !== 'v1' || !ivText || !tagText || !encryptedText) {
    throw new Error('Invalid encrypted Google token');
  }
  for (const key of encryptionKeys()) {
    try {
      const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivText, 'base64url'));
      decipher.setAuthTag(Buffer.from(tagText, 'base64url'));
      return Buffer.concat([
        decipher.update(Buffer.from(encryptedText, 'base64url')),
        decipher.final(),
      ]).toString('utf8');
    } catch {
      // Try the fallback key to support a safe migration from service-role-derived encryption.
    }
  }
  throw new Error('Unable to decrypt Google Calendar credential');
}

async function parseTokenResponse(response: Response) {
  const payload = await response.json().catch(() => ({})) as GoogleTokenResponse;
  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error === 'invalid_grant'
      ? 'Google Calendar authorization expired; please reconnect'
      : 'Unable to authorize Google Calendar');
  }
  return payload;
}

export function getGoogleOAuthCredentials(): GoogleOAuthCredentials {
  const config = getGoogleOAuthPlatformConfig();
  if (!config.configured) throw new Error('QueueBooking Google OAuth is not configured');
  return { clientId: config.clientId, clientSecret: config.clientSecret };
}

export async function exchangeGoogleAuthorizationCode(
  code: string,
  credentials: GoogleOAuthCredentials,
  redirectUri: string,
) {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    }),
    cache: 'no-store',
  });
  return parseTokenResponse(response);
}

async function refreshGoogleAccessToken(connection: GoogleCalendarConnection) {
  const credentials = getGoogleOAuthCredentials();
  const refreshToken = decryptGoogleToken(connection.refresh_token_encrypted);
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
    cache: 'no-store',
  });
  const payload = await parseTokenResponse(response);
  const expiresAt = new Date(Date.now() + Math.max(payload.expires_in ?? 3600, 60) * 1000).toISOString();
  const admin = createAdminClient();
  const { error } = await admin
    .from('google_calendar_connections')
    .update({
      access_token_encrypted: encryptGoogleToken(payload.access_token!),
      refresh_token_encrypted: payload.refresh_token
        ? encryptGoogleToken(payload.refresh_token)
        : connection.refresh_token_encrypted,
      token_expires_at: expiresAt,
      granted_scope: payload.scope ?? undefined,
      last_error: null,
    })
    .eq('id', connection.id)
    .eq('company_id', connection.company_id)
    .eq('shop_id', connection.shop_id);
  if (error) throw new Error('Unable to save refreshed Google Calendar authorization');
  return payload.access_token!;
}

async function getGoogleAccessToken(connection: GoogleCalendarConnection, forceRefresh = false) {
  const expiresAt = connection.token_expires_at ? new Date(connection.token_expires_at).getTime() : 0;
  if (!forceRefresh && expiresAt > Date.now() + 60_000) {
    return decryptGoogleToken(connection.access_token_encrypted);
  }
  return refreshGoogleAccessToken(connection);
}

export async function googleCalendarRequest(
  connection: GoogleCalendarConnection,
  path: string,
  init: RequestInit,
) {
  async function send(accessToken: string) {
    return fetch(`https://www.googleapis.com/calendar/v3${path}`, {
      ...init,
      headers: {
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...init.headers,
        Authorization: `Bearer ${accessToken}`,
      },
      cache: 'no-store',
    });
  }

  let response = await send(await getGoogleAccessToken(connection));
  if (response.status === 401) {
    response = await send(await getGoogleAccessToken(connection, true));
  }
  return response;
}

export async function revokeGoogleCalendarConnection(connection: GoogleCalendarConnection) {
  const token = decryptGoogleToken(connection.refresh_token_encrypted);
  await fetch('https://oauth2.googleapis.com/revoke', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ token }),
    cache: 'no-store',
  }).catch(() => undefined);
}
