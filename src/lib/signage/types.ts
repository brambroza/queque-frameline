/**
 * Shared types for the digital signage feature.
 *
 * Used by API routes (normalisation), the shared renderer (`src/components/signage`)
 * and the portal designer, so keep this file free of React and Supabase imports.
 */

export const SIGNAGE_TEMPLATES = ['classic', 'spotlight', 'counter', 'board', 'minimal'] as const;
export const SIGNAGE_THEMES = ['emerald', 'midnight', 'restaurant', 'clinic', 'meeting', 'nail', 'light'] as const;
export const SIGNAGE_LAYOUTS = ['landscape', 'portrait'] as const;
export const CUSTOMER_NAME_MODES = ['hidden', 'masked', 'full'] as const;

export type SignageTemplate = (typeof SIGNAGE_TEMPLATES)[number];
export type SignageTheme = (typeof SIGNAGE_THEMES)[number];
export type SignageLayout = (typeof SIGNAGE_LAYOUTS)[number];
export type CustomerNameMode = (typeof CUSTOMER_NAME_MODES)[number];

/** Everything a shop can tune about its signage. Mirrors `signage_settings` columns. */
export type SignageConfig = {
  enabled: boolean;
  template: SignageTemplate;
  theme: SignageTheme;
  layout: SignageLayout;
  customer_name_mode: CustomerNameMode;
  show_logo: boolean;
  show_service_name: boolean;
  show_resource_name: boolean;
  show_clock: boolean;
  show_qr: boolean;
  /** Free text shown in the ticker. Max 160 characters. */
  announcement_text: string | null;
  /** 1..10 */
  next_queue_limit: number;
  /** 0..20 */
  waiting_queue_limit: number;
  /** 5..120 */
  refresh_seconds: number;
};

/** One booking as the signage sees it. Names are already reduced per `customer_name_mode`. */
export type SignagePerson = {
  id: string;
  queue_number: string;
  status: string;
  /** 'HH:MM' or null. */
  start_time: string | null;
  called_at: string | null;
  customer_name: string | null;
  service_name: string | null;
  resource_name: string | null;
};

/** Normalised payload rendered by `SignageBoard`. Identical shape for TV, portal preview and mock. */
export type SignageData = {
  /** Bangkok calendar date, YYYY-MM-DD. */
  date: string;
  generated_at: string;
  shop: { name: string; logo_url: string | null; demo_mode_enabled: boolean };
  branch: { id: string; name: string } | null;
  /** Most recently called first; `[0]` is the hero. */
  now_calling: SignagePerson[];
  next_queue: SignagePerson[];
  waiting_queue: SignagePerson[];
  totals: { waiting: number; calling: number; served_today: number };
  /** LIFF booking URL when `show_qr` is on and the shop has a LIFF id. */
  qr_url: string | null;
};

/** Where a loaded config came from, so the designer can label it. */
export type SignageScopeSource = 'branch' | 'shop' | 'default';
