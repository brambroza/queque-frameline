import type { RichMenuState } from '@/lib/line/rich-menu/shop-state';
import type { RichMenuConfig } from '@/lib/line/rich-menu/schema';

/** Capabilities of the shop relevant to publishing. */
export type RichMenuCaps = Pick<RichMenuState, 'has_token' | 'has_liff_booking' | 'has_liff_member'>;

export type BuilderBusy = null | 'save' | 'export' | 'upload' | 'publish' | 'unpublish';

export type BuilderState = {
  loaded: boolean;
  shopName: string;
  config: RichMenuConfig;
  /** Last config confirmed by the server; null when never saved. */
  saved: RichMenuConfig | null;
  imageUrl: string | null;
  lineRichMenuId: string | null;
  publishedAt: string | null;
  caps: RichMenuCaps;
  busy: BuilderBusy;
};

/** True when the in-memory config differs from what the server has. */
export function isDirty(state: BuilderState): boolean {
  return JSON.stringify(state.config) !== JSON.stringify(state.saved);
}
