/**
 * Thin LINE Messaging API client. Bare fetch, no SDK; every function throws on a
 * non-2xx so callers (all wrapped in safe* helpers) can log the reason.
 */
const API = 'https://api.line.me/v2/bot';

async function call(token: string, path: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(init.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`LINE ${path} ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res;
}

export async function replyMessage(token: string, replyToken: string, messages: object[]): Promise<void> {
  await call(token, '/message/reply', { method: 'POST', body: JSON.stringify({ replyToken, messages }) });
}

/** Push to a user id (Uxxxx) or a group id (Cxxxx). Counts against the OA's monthly quota. */
export async function pushMessage(token: string, to: string, messages: object[]): Promise<void> {
  await call(token, '/message/push', { method: 'POST', body: JSON.stringify({ to, messages }) });
}

export type LineProfile = { userId: string; displayName: string; pictureUrl?: string; statusMessage?: string };

export async function getProfile(token: string, userId: string): Promise<LineProfile> {
  return (await call(token, `/profile/${encodeURIComponent(userId)}`)).json() as Promise<LineProfile>;
}

export async function getGroupSummary(token: string, groupId: string): Promise<{ groupId: string; groupName: string }> {
  return (await call(token, `/group/${encodeURIComponent(groupId)}/summary`)).json() as Promise<{ groupId: string; groupName: string }>;
}

/** Used by the settings "test connection" button. */
export async function getBotInfo(token: string): Promise<{ userId: string; basicId: string; displayName: string; pictureUrl?: string }> {
  return (await call(token, '/info')).json() as Promise<{ userId: string; basicId: string; displayName: string; pictureUrl?: string }>;
}

// ───────────────────────────── rich menu ─────────────────────────────

/** Rich menu image upload goes through the data host, not api.line.me. */
const API_DATA = 'https://api-data.line.me/v2/bot';

/** Create a rich menu (areas + size); returns the new `richMenuId`. The image is uploaded separately. */
export async function createRichMenu(token: string, body: object): Promise<string> {
  const json = (await (await call(token, '/richmenu', { method: 'POST', body: JSON.stringify(body) })).json()) as { richMenuId?: string };
  if (!json.richMenuId) throw new Error('LINE /richmenu: no richMenuId in response');
  return json.richMenuId;
}

/** Upload the PNG for a rich menu (must match the declared size, ≤ 1 MB). */
export async function uploadRichMenuImage(token: string, richMenuId: string, png: Uint8Array): Promise<void> {
  const res = await fetch(`${API_DATA}/richmenu/${encodeURIComponent(richMenuId)}/content`, {
    method: 'POST',
    headers: { 'Content-Type': 'image/png', Authorization: `Bearer ${token}` },
    body: new Blob([png as BlobPart], { type: 'image/png' }),
  });
  if (!res.ok) throw new Error(`LINE /richmenu/content ${res.status}: ${(await res.text()).slice(0, 300)}`);
}

/** Show this menu to every user without a per-user menu. */
export async function setDefaultRichMenu(token: string, richMenuId: string): Promise<void> {
  await call(token, `/user/all/richmenu/${encodeURIComponent(richMenuId)}`, { method: 'POST' });
}

/** Remove the default menu. 404 = there was none. */
export async function clearDefaultRichMenu(token: string): Promise<void> {
  try {
    await call(token, '/user/all/richmenu', { method: 'DELETE' });
  } catch (e) {
    if (e instanceof Error && / 404:/.test(e.message)) return;
    throw e;
  }
}

/** Delete a rich menu. 404 = already gone. */
export async function deleteRichMenu(token: string, richMenuId: string): Promise<void> {
  try {
    await call(token, `/richmenu/${encodeURIComponent(richMenuId)}`, { method: 'DELETE' });
  } catch (e) {
    if (e instanceof Error && / 404:/.test(e.message)) return;
    throw e;
  }
}

/** Id of the current default menu, or null when none is set (LINE answers 404). */
export async function getDefaultRichMenuId(token: string): Promise<string | null> {
  try {
    const json = (await (await call(token, '/user/all/richmenu')).json()) as { richMenuId?: string };
    return json.richMenuId ?? null;
  } catch (e) {
    if (e instanceof Error && / 404:/.test(e.message)) return null;
    throw e;
  }
}
