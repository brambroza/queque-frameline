import type { LineRichMenuRequest } from './line-request';

const API = 'https://api.line.me/v2/bot';
/** Rich menu image upload/download go through the data host, not api.line.me. */
const API_DATA = 'https://api-data.line.me/v2/bot';

/** Error from the LINE Messaging API with the HTTP status preserved. */
export class LineApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'LineApiError';
    this.status = status;
  }
}

async function lineFetch(token: string, url: string, init: RequestInit): Promise<Response> {
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init.headers ?? {}) },
  });
  if (!res.ok) {
    let message = `LINE API ${res.status}`;
    try {
      const body = (await res.json()) as { message?: string; details?: Array<{ message?: string; property?: string }> };
      const details = body.details?.map((d) => [d.property, d.message].filter(Boolean).join(': ')).filter(Boolean);
      message = [body.message, ...(details ?? [])].filter(Boolean).join(' — ') || message;
    } catch {
      // non-JSON body — keep the status message
    }
    throw new LineApiError(res.status, message);
  }
  return res;
}

/** Create a rich menu; returns the new `richMenuId`. */
export async function createRichMenu(token: string, body: LineRichMenuRequest): Promise<string> {
  const res = await lineFetch(token, `${API}/richmenu`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as { richMenuId?: string };
  if (!json.richMenuId) throw new LineApiError(502, 'LINE ไม่ส่ง richMenuId กลับมา');
  return json.richMenuId;
}

/** Upload the PNG/JPEG for a rich menu (must match the declared size, ≤ 1 MB). */
export async function uploadRichMenuImage(token: string, richMenuId: string, bytes: Uint8Array, contentType: 'image/png' | 'image/jpeg'): Promise<void> {
  await lineFetch(token, `${API_DATA}/richmenu/${encodeURIComponent(richMenuId)}/content`, {
    method: 'POST',
    headers: { 'Content-Type': contentType },
    body: new Blob([bytes as BlobPart], { type: contentType }),
  });
}

/** Set the rich menu shown to every user who has no per-user menu linked. */
export async function setDefaultRichMenu(token: string, richMenuId: string): Promise<void> {
  await lineFetch(token, `${API}/user/all/richmenu/${encodeURIComponent(richMenuId)}`, { method: 'POST' });
}

/** Remove the default rich menu (users keep any per-user menu). */
export async function clearDefaultRichMenu(token: string): Promise<void> {
  await lineFetch(token, `${API}/user/all/richmenu`, { method: 'DELETE' });
}

/** Delete a rich menu by id. 404 is treated as already gone. */
export async function deleteRichMenu(token: string, richMenuId: string): Promise<void> {
  try {
    await lineFetch(token, `${API}/richmenu/${encodeURIComponent(richMenuId)}`, { method: 'DELETE' });
  } catch (e) {
    if (e instanceof LineApiError && e.status === 404) return;
    throw e;
  }
}
