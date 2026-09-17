/**
 * Verify a LIFF ID token with LINE and return the LINE user id it proves.
 *
 * The public LIFF routes historically trust a `line_user_id` string sent in the
 * request body, which anyone who knows a shop key and a Uxxxx id can forge. This
 * closes that for the payment routes: only LINE can mint a token whose `sub`
 * matches a real user.
 *
 * Returns null on any failure — callers decide whether that is fatal.
 */
export async function verifyLiffIdToken(idToken: string, channelId: string): Promise<string | null> {
  if (!idToken || !channelId) return null;
  try {
    const res = await fetch('https://api.line.me/oauth2/v2.1/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ id_token: idToken, client_id: channelId }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { sub?: string };
    return json.sub ?? null;
  } catch (e) {
    console.error('[line] id token verify failed:', e instanceof Error ? e.message : e);
    return null;
  }
}

/**
 * Resolve the LINE Login channel id used to verify tokens for a shop.
 * Falls back to the platform-wide env var so single-channel deployments work.
 */
export function resolveLoginChannelId(shopChannelId?: string | null): string {
  return shopChannelId || process.env.LINE_LOGIN_CHANNEL_ID || '';
}
