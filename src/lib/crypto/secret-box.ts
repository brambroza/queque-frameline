import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

/**
 * Symmetric encryption for secrets at rest (bank credentials, OAuth tokens).
 *
 * Format: `v1.<iv>.<tag>.<ciphertext>`, each part base64url — identical to the
 * Google Calendar token format in src/lib/google-calendar/oauth.ts so the two
 * can share seeds and be migrated onto this helper later.
 *
 * Several seeds may be supplied: the first one encrypts, every one is tried on
 * decrypt. That lets a deployment rotate from the service-role-derived key to a
 * dedicated key without re-encrypting rows first.
 */
export interface SecretBox {
  /** Encrypt a UTF-8 string. */
  seal(plain: string): string;
  /** Decrypt a value produced by `seal`. Throws on tampering or unknown key. */
  open(sealed: string): string;
  /** True when at least one seed is configured. */
  readonly configured: boolean;
}

const FORMAT_VERSION = 'v1';

function deriveKeys(seeds: readonly string[]): Buffer[] {
  const unique = Array.from(new Set(seeds.filter((s) => typeof s === 'string' && s.length > 0)));
  return unique.map((seed) => createHash('sha256').update(seed, 'utf8').digest());
}

/**
 * Build a secret box from one or more seeds. Seeds are hashed to 32-byte keys,
 * so any long random string works.
 */
export function createSecretBox(seeds: readonly string[]): SecretBox {
  const keys = deriveKeys(seeds);

  return {
    configured: keys.length > 0,

    seal(plain: string): string {
      if (keys.length === 0) throw new Error('Secret box is not configured');
      const iv = randomBytes(12);
      const cipher = createCipheriv('aes-256-gcm', keys[0], iv);
      const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
      const tag = cipher.getAuthTag();
      return [
        FORMAT_VERSION,
        iv.toString('base64url'),
        tag.toString('base64url'),
        encrypted.toString('base64url'),
      ].join('.');
    },

    open(sealed: string): string {
      const [version, ivText, tagText, encryptedText] = sealed.split('.');
      if (version !== FORMAT_VERSION || !ivText || !tagText || !encryptedText) {
        throw new Error('Invalid sealed value');
      }
      for (const key of keys) {
        try {
          const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivText, 'base64url'));
          decipher.setAuthTag(Buffer.from(tagText, 'base64url'));
          return Buffer.concat([
            decipher.update(Buffer.from(encryptedText, 'base64url')),
            decipher.final(),
          ]).toString('utf8');
        } catch {
          // Wrong key or tampered payload — try the next seed.
        }
      }
      throw new Error('Unable to open sealed value');
    },
  };
}

/**
 * Box for payment-provider credentials. Prefers a dedicated key; falls back to
 * the Google token key and finally the service-role key so existing deployments
 * work before they add PAYMENT_CREDENTIALS_KEY.
 */
export function paymentSecretBox(): SecretBox {
  return createSecretBox([
    process.env.PAYMENT_CREDENTIALS_KEY ?? '',
    process.env.GOOGLE_TOKEN_ENCRYPTION_KEY ?? '',
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  ]);
}
