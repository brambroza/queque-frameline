import type { SupabaseClient } from '@supabase/supabase-js';
import { isValidLiffId, normalizeLiffId } from '@/lib/line/liff-id';
import { normalizeBusinessType, type BusinessType } from './business-types';
import { RichMenuConfigSchema, type RichMenuConfig } from './schema';
import { templateForBusiness } from './templates';

/** Columns read from `shops` for the rich menu builder. */
export type RichMenuShopRow = {
  id: string;
  name: string;
  shop_key: string | null;
  business_type: string | null;
  rich_menu_config: unknown;
  rich_menu_image_url: string | null;
  line_rich_menu_id: string | null;
  rich_menu_published_at: string | null;
  liff_id: string | null;
  liff_id_login_shop: string | null;
  line_channel_access_token: string | null;
};

export const RICH_MENU_SHOP_COLUMNS =
  'id,name,shop_key,business_type,rich_menu_config,rich_menu_image_url,line_rich_menu_id,rich_menu_published_at,liff_id,liff_id_login_shop,line_channel_access_token';

/** Public state the builder page receives — never includes the token itself. */
export type RichMenuState = {
  shop_name: string;
  business_type: BusinessType | null;
  /** Saved config, or null when nothing valid is stored. */
  config: RichMenuConfig | null;
  /** Default template for the shop's business type (used when `config` is null). */
  template: RichMenuConfig;
  image_url: string | null;
  line_rich_menu_id: string | null;
  published_at: string | null;
  has_token: boolean;
  has_liff_booking: boolean;
  has_liff_member: boolean;
};

/** Parse a stored config; corrupt/old data yields null instead of an error. */
export function parseStoredConfig(raw: unknown): RichMenuConfig | null {
  if (!raw) return null;
  const parsed = RichMenuConfigSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

/** Load the shop row (tenant scoped) for the rich menu routes. */
export async function loadRichMenuShop(supabase: SupabaseClient, shopId: string): Promise<RichMenuShopRow> {
  const { data, error } = await supabase.from('shops').select(RICH_MENU_SHOP_COLUMNS).eq('id', shopId).single<RichMenuShopRow>();
  if (error) throw error;
  return data;
}

/** True when the stored value normalizes to a well-formed LIFF id (a pasted LIFF URL counts). */
function hasUsableLiffId(raw: string | null): boolean {
  const id = normalizeLiffId(raw);
  return Boolean(id) && isValidLiffId(id);
}

/** Turn a shop row into the builder state. */
export function toRichMenuState(shop: RichMenuShopRow): RichMenuState {
  const businessType = normalizeBusinessType(shop.business_type);
  return {
    shop_name: shop.name,
    business_type: businessType,
    config: parseStoredConfig(shop.rich_menu_config),
    template: templateForBusiness(businessType),
    image_url: shop.rich_menu_image_url ?? null,
    line_rich_menu_id: shop.line_rich_menu_id ?? null,
    published_at: shop.rich_menu_published_at ?? null,
    has_token: Boolean(shop.line_channel_access_token),
    has_liff_booking: hasUsableLiffId(shop.liff_id),
    has_liff_member: hasUsableLiffId(shop.liff_id_login_shop),
  };
}
