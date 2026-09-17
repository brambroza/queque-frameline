import { describe, expect, it } from 'vitest';
import {
  applyActingShop,
  parseAdminShopCookie,
  resolveActingShop,
  type ActingShop,
  type ShopLookupClient,
} from './admin-shop-cookie';

const SHOP_ID = '11111111-2222-4333-8444-555555555555';

/** Chainable `from('shops')` stub whose `maybeSingle()` resolves to `row`. */
function stubClient(row: Record<string, unknown> | null, error: unknown = null): ShopLookupClient {
  const chain: Record<string, unknown> = {};
  const self = () => chain;
  Object.assign(chain, {
    select: self,
    eq: self,
    maybeSingle: () => Promise.resolve({ data: row, error }),
  });
  return { from: () => chain } as unknown as ShopLookupClient;
}

describe('parseAdminShopCookie', () => {
  it('accepts a uuid and trims whitespace', () => {
    expect(parseAdminShopCookie(`  ${SHOP_ID} `)).toBe(SHOP_ID);
  });

  it('rejects missing or malformed values', () => {
    expect(parseAdminShopCookie(undefined)).toBeNull();
    expect(parseAdminShopCookie(null)).toBeNull();
    expect(parseAdminShopCookie('')).toBeNull();
    expect(parseAdminShopCookie('not-a-uuid')).toBeNull();
    expect(parseAdminShopCookie("' or 1=1 --")).toBeNull();
  });
});

describe('resolveActingShop', () => {
  it('maps a live shop row', async () => {
    const client = stubClient({ id: SHOP_ID, company_id: 'c1', name: 'Shop A', logo_url: null, demo_mode_enabled: true });
    await expect(resolveActingShop(client, SHOP_ID)).resolves.toEqual({
      id: SHOP_ID,
      company_id: 'c1',
      name: 'Shop A',
      logo_url: null,
      demo_mode_enabled: true,
    });
  });

  it('returns null for a missing shop, a query error, or no id', async () => {
    await expect(resolveActingShop(stubClient(null), SHOP_ID)).resolves.toBeNull();
    await expect(resolveActingShop(stubClient({ id: SHOP_ID }, new Error('boom')), SHOP_ID)).resolves.toBeNull();
    await expect(resolveActingShop(stubClient({ id: SHOP_ID }), null)).resolves.toBeNull();
  });
});

describe('applyActingShop', () => {
  const shop: ActingShop = { id: SHOP_ID, company_id: 'c1', name: 'Shop A', logo_url: null, demo_mode_enabled: false };
  const own = { company_id: 'own-company', shop_id: 'own-shop' };

  it('overrides the tenant for a super_admin', () => {
    expect(applyActingShop({ company_id: null, shop_id: null }, ['super_admin'], shop)).toEqual({ company_id: 'c1', shop_id: SHOP_ID });
    // A super_admin who also owns a shop can still switch away from it.
    expect(applyActingShop(own, ['shop_owner', 'super_admin'], shop)).toEqual({ company_id: 'c1', shop_id: SHOP_ID });
  });

  it('keeps the profile when no shop is selected', () => {
    expect(applyActingShop(own, ['super_admin'], null)).toBe(own);
  });

  it('ignores the acting shop for anyone who is not a super_admin', () => {
    expect(applyActingShop(own, ['shop_owner'], shop)).toBe(own);
    expect(applyActingShop(own, [], shop)).toBe(own);
  });
});
