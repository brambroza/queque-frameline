/** Longest nickname the customers table accepts (mirrors the DB check constraint). */
export const NICKNAME_MAX = 100;

export type CustomerNameFields = {
  full_name?: string | null;
  nickname?: string | null;
};

/**
 * Trimmed nickname, or null when the customer has not set one.
 */
export function customerNickname(c?: CustomerNameFields | null): string | null {
  const v = c?.nickname?.trim();
  return v ? v : null;
}

/**
 * How staff-facing screens name a customer: "นัท (ณัฐพล)" when a nickname is
 * set, the real name alone otherwise, and "-" for a booking with no customer.
 * The nickname leads because it is what staff call out.
 */
export function customerLabel(c?: CustomerNameFields | null): string {
  const nickname = customerNickname(c);
  const fullName = c?.full_name?.trim() || '';
  if (nickname && fullName && nickname !== fullName) return `${nickname} (${fullName})`;
  return nickname || fullName || '-';
}

/**
 * Normalise a nickname coming from a form or API body for storage:
 * `undefined` = leave the stored value alone, `''` = clear it, otherwise trimmed.
 */
export function normalizeNicknameInput(value: string | null | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  const trimmed = (value ?? '').trim();
  return trimmed ? trimmed.slice(0, NICKNAME_MAX) : null;
}

/**
 * Update-payload fragment for the nickname column. An omitted field yields `{}`
 * so the stored value is left alone; `''`/`null` clears it; otherwise the trimmed
 * value is written. Spread this into the row instead of `nickname: … ?? null`,
 * which would wipe a nickname every time a caller leaves the field out.
 */
export function nicknamePatch(value: string | null | undefined): { nickname?: string | null } {
  const nickname = normalizeNicknameInput(value);
  return nickname === undefined ? {} : { nickname };
}
