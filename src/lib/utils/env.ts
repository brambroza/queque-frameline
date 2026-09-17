export const env = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://example.supabase.co',
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'public-anon-key-placeholder',
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
  omiseSecretKey: process.env.OMISE_SECRET_KEY ?? '',
  omisePublicKey: process.env.OMISE_PUBLIC_KEY ?? '',
  googleOAuthClientId: process.env.GOOGLE_OAUTH_CLIENT_ID ?? '',
  googleOAuthClientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET ?? '',
  googleTokenEncryptionKey: process.env.GOOGLE_TOKEN_ENCRYPTION_KEY ?? '',
  /** Seals per-shop bank deeplink credentials. Falls back to the Google token key / service-role key. */
  paymentCredentialsKey: process.env.PAYMENT_CREDENTIALS_KEY ?? '',
  /** HMAC key for public payment links; mandatory for bank deeplink (the return page relies on it). */
  paymentLinkSecret: process.env.PAYMENT_LINK_SECRET ?? '',
};

export function assertEnv() {
  const required = ['supabaseUrl', 'supabaseAnonKey'];
  for (const key of required) {
    if (!env[key as keyof typeof env]) {
      throw new Error(`Missing required env: ${key}`);
    }
  }
}
