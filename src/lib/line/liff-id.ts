/**
 * Extract a bare LIFF ID from whatever was pasted. The LINE console shows both
 * the id (`1234567890-abcdefgh`) and the URL (`https://liff.line.me/…`).
 */
export function normalizeLiffId(input?: string | null): string {
  if (!input) return '';
  const raw = String(input).trim();
  const match = raw.match(/liff\.line\.me\/([^/?#]+)/);
  return match?.[1] ?? raw;
}

export function isValidLiffId(value: string): boolean {
  return /^\d{8,12}-[A-Za-z0-9]{4,20}$/.test(value);
}
