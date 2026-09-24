/**
 * Site LINE configuration. The DB row wins; env vars are a fallback so a
 * deployment can be wired without touching the portal.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export type LineConfig = {
  channel_access_token: string | null;
  channel_secret: string | null;
  login_channel_id: string | null;
  liff_id: string | null;
  oa_basic_id: string | null;
  staff_group_id: string | null;
  staff_group_name: string | null;
  notify_customer: boolean;
  notify_driver: boolean;
  notify_staff_group: boolean;
  webhook_verified_at: string | null;
  /** Rich menu this system published (null = none). */
  rich_menu_id: string | null;
  rich_menu_published_at: string | null;
};

export const LINE_CONFIG_COLUMNS =
  'channel_access_token,channel_secret,login_channel_id,liff_id,oa_basic_id,staff_group_id,staff_group_name,notify_customer,notify_driver,notify_staff_group,webhook_verified_at,rich_menu_id,rich_menu_published_at';

const EMPTY: LineConfig = {
  channel_access_token: null, channel_secret: null, login_channel_id: null, liff_id: null, oa_basic_id: null,
  staff_group_id: null, staff_group_name: null, notify_customer: true, notify_driver: true, notify_staff_group: true, webhook_verified_at: null,
  rich_menu_id: null, rich_menu_published_at: null,
};

/** Config with env fallbacks applied. `channel_access_token` null = LINE not set up; every notify skips. */
export async function getLineConfig(client: SupabaseClient, shopId: string): Promise<LineConfig> {
  const { data } = await client.from('line_config').select(LINE_CONFIG_COLUMNS).eq('shop_id', shopId).maybeSingle();
  const row = { ...EMPTY, ...((data as Partial<LineConfig> | null) ?? {}) };
  return {
    ...row,
    channel_access_token: row.channel_access_token || process.env.LINE_CHANNEL_ACCESS_TOKEN || null,
    channel_secret: row.channel_secret || process.env.LINE_CHANNEL_SECRET || null,
    login_channel_id: row.login_channel_id || process.env.LINE_LOGIN_CHANNEL_ID || null,
    liff_id: row.liff_id || process.env.NEXT_PUBLIC_LIFF_ID || null,
  };
}

export function isLineConfigured(cfg: LineConfig): cfg is LineConfig & { channel_access_token: string } {
  return Boolean(cfg.channel_access_token);
}

/**
 * LIFF deep link for a page of this app. LIFF appends the path to the app's
 * endpoint URL (which is the site root), and `via=line` tells the page to bind
 * the LINE user. Returns null when no LIFF app is configured.
 */
export function liffUrl(cfg: Pick<LineConfig, 'liff_id'>, path: string): string | null {
  if (!cfg.liff_id) return null;
  const clean = path.startsWith('/') ? path : `/${path}`;
  return `https://liff.line.me/${cfg.liff_id}${clean}${clean.includes('?') ? '&' : '?'}via=line`;
}

/** Add-friend URL for the OA, when its basic id (@xxxx) is known. */
export function addFriendUrl(cfg: Pick<LineConfig, 'oa_basic_id'>): string | null {
  const id = (cfg.oa_basic_id ?? '').trim().replace(/^@/, '');
  return id ? `https://line.me/R/ti/p/@${id}` : null;
}
