/**
 * Web Push (VAPID) configuration. Optional integration: when the keys are
 * blank every send is skipped and reported as `not_configured` — callers must
 * never let that break a gate action.
 *
 * Generate a key pair once with `npx web-push generate-vapid-keys` and put it
 * in env. The private key is read from env only and never logged or sent to
 * the client; the public key is handed to the driver page so the browser can
 * subscribe.
 */

export type PushConfig = {
  publicKey: string;
  privateKey: string;
  /** `mailto:` or `https:` contact the push service may use to reach the operator. */
  subject: string;
};

/**
 * @param env Defaults to `process.env`; injectable for tests.
 * @returns null unless both keys are present — a half-configured pair counts as disabled.
 */
export function getPushConfig(env: Record<string, string | undefined> = process.env): PushConfig | null {
  const publicKey = env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = env.VAPID_PRIVATE_KEY?.trim();
  if (!publicKey || !privateKey) return null;
  const explicit = env.VAPID_SUBJECT?.trim();
  const appUrl = (env.NEXT_PUBLIC_APP_URL ?? '').trim();
  const subject = explicit && /^(mailto:|https:)/.test(explicit) ? explicit : appUrl.startsWith('https://') ? appUrl : 'mailto:admin@example.com';
  return { publicKey, privateKey, subject };
}

/** True when a send would actually go out. */
export function isPushConfigured(env: Record<string, string | undefined> = process.env): boolean {
  return getPushConfig(env) !== null;
}
