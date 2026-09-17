/**
 * Extracts a bare LIFF ID from whatever the shop owner pasted.
 *
 * The LINE console shows both a LIFF ID (`1234567890-abcdefgh`) and a LIFF URL
 * (`https://liff.line.me/1234567890-abcdefgh`), and pasting the URL used to
 * save without complaint and silently break booking.
 *
 * @param input - Raw value from the settings form.
 * @returns The bare LIFF ID, or an empty string when nothing usable was given.
 */
export function normalizeLiffId(input?: string | null): string {
  if (!input) return '';
  const raw = String(input).trim();
  if (!raw) return '';
  const match = raw.match(/liff\.line\.me\/([^/?#]+)/);
  return match?.[1] ?? raw;
}

/** LIFF IDs look like `1234567890-abcdefgh`. */
export function isValidLiffId(value: string): boolean {
  return /^\d{8,12}-[A-Za-z0-9]{4,20}$/.test(value);
}
