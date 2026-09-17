import { cookies } from 'next/headers';
import { z } from 'zod';
import type { createAdminClient } from '@/lib/supabase/admin';
import type { AppRole } from '@/types/db';

/**
 * Cookie that remembers which shop a global `super_admin` is currently acting in.
 *
 * The value is only a shop id: authority is re-derived from `user_roles` on every
 * request, so a forged or stale cookie grants nothing to a non-admin.
 */
export const ADMIN_SHOP_COOKIE = 'portal_admin_shop_id';

/** 30 days — long enough to survive a normal working week of admin sessions. */
export const ADMIN_SHOP_COOKIE_MAX_AGE = 30 * 24 * 60 * 60;

const UuidSchema = z.string().uuid();

/** Shop fields the portal shell and auth context need when acting on behalf of a shop. */
export type ActingShop = {
  id: string;
  company_id: string | null;
  name: string | null;
  logo_url: string | null;
  demo_mode_enabled: boolean;
};

/** Structural subset of the service-role client, so tests can stub `from()`. */
export type ShopLookupClient = Pick<ReturnType<typeof createAdminClient>, 'from'>;

/** Tenant part of the auth profile that the acting shop may override. */
export type TenantProfile = { company_id: string | null; shop_id: string | null };

/**
 * Validate a raw cookie value: only a well-formed uuid is accepted.
 *
 * @param value Raw cookie value, possibly missing.
 * @returns The trimmed uuid, or null when absent or malformed.
 */
export function parseAdminShopCookie(value: string | null | undefined): string | null {
  if (!value) return null;
  const parsed = UuidSchema.safeParse(value.trim());
  return parsed.success ? parsed.data : null;
}

/**
 * Read the acting-shop cookie of the current request (Server Component or Route Handler).
 *
 * @returns Validated shop id, or null when no usable cookie is present.
 */
export async function readAdminShopCookie(): Promise<string | null> {
  const store = await cookies();
  return parseAdminShopCookie(store.get(ADMIN_SHOP_COOKIE)?.value);
}

/**
 * Cookie attributes for the acting-shop cookie.
 *
 * @param secure True when the request is served over https (production).
 */
export function adminShopCookieOptions(secure: boolean) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure,
    path: '/',
    maxAge: ADMIN_SHOP_COOKIE_MAX_AGE,
  };
}

/**
 * Look up the shop behind an acting-shop id. A deleted or unknown shop resolves to
 * null so callers treat it exactly like "no shop selected".
 *
 * @param client Service-role client (the `shops` policy is not reliable for admins).
 * @param shopId Candidate shop id, usually from {@link readAdminShopCookie}.
 */
export async function resolveActingShop(client: ShopLookupClient, shopId: string | null): Promise<ActingShop | null> {
  if (!shopId) return null;
  const { data, error } = await client
    .from('shops')
    .select('id,company_id,name,logo_url,demo_mode_enabled')
    .eq('id', shopId)
    .eq('is_deleted', false)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as { id: string; company_id: string | null; name: string | null; logo_url: string | null; demo_mode_enabled: boolean | null };
  return {
    id: row.id,
    company_id: row.company_id ?? null,
    name: row.name ?? null,
    logo_url: row.logo_url ?? null,
    demo_mode_enabled: Boolean(row.demo_mode_enabled),
  };
}

/**
 * Swap the tenant context for the acting shop, but only for a `super_admin`.
 *
 * Any other caller keeps their own profile untouched, which is what makes a leftover
 * or forged cookie harmless.
 *
 * @param profile Tenant profile resolved from `users_profile` / `user_roles`.
 * @param roles Roles resolved server-side for this request.
 * @param shop Acting shop, or null when none is selected / valid.
 */
export function applyActingShop<P extends TenantProfile>(profile: P, roles: AppRole[], shop: ActingShop | null): P {
  if (!shop || !roles.includes('super_admin')) return profile;
  return { ...profile, company_id: shop.company_id, shop_id: shop.id };
}
