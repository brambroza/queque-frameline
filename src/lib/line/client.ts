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
