/**
 * Verify a LIFF ID token with LINE and return the LINE user id it proves.
 * Only LINE can mint a token whose `sub` matches a real user, so this is the
 * one thing the public bind routes trust. Returns null on any failure.
 */
export async function verifyLiffIdToken(idToken: string, loginChannelId: string): Promise<{ userId: string; name?: string; picture?: string } | null> {
  if (!idToken || !loginChannelId) return null;
  try {
    const res = await fetch('https://api.line.me/oauth2/v2.1/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ id_token: idToken, client_id: loginChannelId }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { sub?: string; name?: string; picture?: string };
    return json.sub ? { userId: json.sub, name: json.name, picture: json.picture } : null;
  } catch (e) {
    console.error('[line] id token verify failed:', e instanceof Error ? e.message : e);
    return null;
  }
}
