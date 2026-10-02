/**
 * Client-safe flag for accounts still on the shared starting password
 * (see `welcome-email.ts`). Set by POST /api/staff, cleared by /set-password.
 */

/** user_metadata key: the account still uses the starting password. */
export const MUST_CHANGE_PASSWORD_KEY = 'must_change_password';

/** True when the signed-in user should be offered a password change. */
export function mustChangePassword(metadata: Record<string, unknown> | null | undefined): boolean {
  return metadata?.[MUST_CHANGE_PASSWORD_KEY] === true;
}
