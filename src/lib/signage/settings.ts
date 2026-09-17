import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import {
  CUSTOMER_NAME_MODES,
  SIGNAGE_LAYOUTS,
  SIGNAGE_TEMPLATES,
  SIGNAGE_THEMES,
  type SignageConfig,
  type SignageScopeSource,
  type SignageTemplate,
  type SignageTheme,
} from './types';

export const SIGNAGE_ANNOUNCEMENT_MAX = 160;

/** Zod schema for a full config. Also the single source of truth for numeric ranges. */
export const SignageConfigSchema = z.object({
  enabled: z.boolean(),
  template: z.enum(SIGNAGE_TEMPLATES),
  theme: z.enum(SIGNAGE_THEMES),
  layout: z.enum(SIGNAGE_LAYOUTS),
  customer_name_mode: z.enum(CUSTOMER_NAME_MODES),
  show_logo: z.boolean(),
  show_service_name: z.boolean(),
  show_resource_name: z.boolean(),
  show_clock: z.boolean(),
  show_qr: z.boolean(),
  announcement_text: z.string().trim().max(SIGNAGE_ANNOUNCEMENT_MAX).nullable(),
  next_queue_limit: z.number().int().min(1).max(10),
  waiting_queue_limit: z.number().int().min(0).max(20),
  refresh_seconds: z.number().int().min(5).max(120),
});

export const DEFAULT_SIGNAGE_CONFIG: SignageConfig = {
  enabled: true,
  template: 'classic',
  theme: 'emerald',
  layout: 'landscape',
  customer_name_mode: 'masked',
  show_logo: true,
  show_service_name: true,
  show_resource_name: true,
  show_clock: true,
  show_qr: false,
  announcement_text: null,
  next_queue_limit: 5,
  waiting_queue_limit: 10,
  refresh_seconds: 10,
};

/**
 * Sensible template/palette per demo business type. Keyed by string so this file
 * does not depend on the demo module; unknown keys fall back to the default.
 */
export const SIGNAGE_DEFAULTS_BY_BUSINESS: Record<string, Pick<SignageConfig, 'template' | 'theme'>> = {
  restaurant: { template: 'spotlight', theme: 'restaurant' },
  buffet: { template: 'board', theme: 'restaurant' },
  clinic: { template: 'counter', theme: 'clinic' },
  meeting_room: { template: 'counter', theme: 'meeting' },
  barber: { template: 'classic', theme: 'midnight' },
  general_service: { template: 'classic', theme: 'emerald' },
};

/** Pick the template/theme preset for a business type, defaulting when unknown. */
export function signageDefaultsForBusiness(businessType?: string | null): Pick<SignageConfig, 'template' | 'theme'> {
  return SIGNAGE_DEFAULTS_BY_BUSINESS[businessType ?? ''] ?? { template: DEFAULT_SIGNAGE_CONFIG.template, theme: DEFAULT_SIGNAGE_CONFIG.theme };
}

/** Raw `signage_settings` row as returned by Supabase (only the columns we read). */
export type SignageSettingsRow = {
  id: string;
  branch_id: string | null;
  enabled: boolean | null;
  template: string | null;
  theme: string | null;
  layout: string | null;
  customer_name_mode: string | null;
  show_logo: boolean | null;
  show_service_name: boolean | null;
  show_resource_name: boolean | null;
  show_clock: boolean | null;
  show_qr: boolean | null;
  announcement_text: string | null;
  next_queue_limit: number | null;
  waiting_queue_limit: number | null;
  refresh_seconds: number | null;
};

const SIGNAGE_ROW_SELECT =
  'id,branch_id,enabled,template,theme,layout,customer_name_mode,show_logo,show_service_name,show_resource_name,show_clock,show_qr,announcement_text,next_queue_limit,waiting_queue_limit,refresh_seconds';

const LEGACY_THEME_MAP: Record<string, SignageTheme> = { dark: 'emerald', default: 'emerald' };

function pickEnum<T extends string>(value: string | null | undefined, allowed: readonly T[], fallback: T): T {
  return value && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

/**
 * Turn a DB row into a fully valid config. Unknown or legacy values fall back to
 * defaults so a bad row never breaks the TV.
 */
export function normalizeSignageRow(row: Partial<SignageSettingsRow> | null | undefined): SignageConfig {
  const d = DEFAULT_SIGNAGE_CONFIG;
  if (!row) return { ...d };
  const themeRaw = row.theme ? LEGACY_THEME_MAP[row.theme] ?? row.theme : null;
  const parsed = SignageConfigSchema.safeParse({
    enabled: row.enabled ?? d.enabled,
    template: pickEnum<SignageTemplate>(row.template, SIGNAGE_TEMPLATES, d.template),
    theme: pickEnum<SignageTheme>(themeRaw, SIGNAGE_THEMES, d.theme),
    layout: pickEnum(row.layout, SIGNAGE_LAYOUTS, d.layout),
    customer_name_mode: pickEnum(row.customer_name_mode, CUSTOMER_NAME_MODES, d.customer_name_mode),
    show_logo: row.show_logo ?? d.show_logo,
    show_service_name: row.show_service_name ?? d.show_service_name,
    show_resource_name: row.show_resource_name ?? d.show_resource_name,
    show_clock: row.show_clock ?? d.show_clock,
    show_qr: row.show_qr ?? d.show_qr,
    announcement_text: row.announcement_text?.slice(0, SIGNAGE_ANNOUNCEMENT_MAX) || null,
    next_queue_limit: clamp(row.next_queue_limit, 1, 10, d.next_queue_limit),
    waiting_queue_limit: clamp(row.waiting_queue_limit, 0, 20, d.waiting_queue_limit),
    refresh_seconds: clamp(row.refresh_seconds, 5, 120, d.refresh_seconds),
  });
  return parsed.success ? parsed.data : { ...d };
}

function clamp(value: number | null | undefined, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}

export type LoadedSignageSettings = {
  config: SignageConfig;
  source: SignageScopeSource;
  settings_id: string | null;
  branch_id: string | null;
};

/**
 * Load the effective signage config for a shop, optionally narrowed to a branch.
 *
 * Resolution order: branch row → shop-wide row (`branch_id IS NULL`) → defaults.
 * Works with both the RLS session client and the admin client.
 */
export async function loadSignageSettings(
  client: SupabaseClient,
  shopId: string,
  branchId: string | null,
): Promise<LoadedSignageSettings> {
  if (branchId) {
    const { data: branchRow, error: branchError } = await client
      .from('signage_settings')
      .select(SIGNAGE_ROW_SELECT)
      .eq('shop_id', shopId)
      .eq('branch_id', branchId)
      .eq('is_deleted', false)
      .limit(1)
      .maybeSingle<SignageSettingsRow>();
    if (branchError) throw branchError;
    if (branchRow) return { config: normalizeSignageRow(branchRow), source: 'branch', settings_id: branchRow.id, branch_id: branchId };
  }

  const { data: shopRow, error: shopError } = await client
    .from('signage_settings')
    .select(SIGNAGE_ROW_SELECT)
    .eq('shop_id', shopId)
    .is('branch_id', null)
    .eq('is_deleted', false)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle<SignageSettingsRow>();
  if (shopError) throw shopError;
  if (shopRow) return { config: normalizeSignageRow(shopRow), source: 'shop', settings_id: shopRow.id, branch_id: null };

  return { config: { ...DEFAULT_SIGNAGE_CONFIG }, source: 'default', settings_id: null, branch_id: null };
}

export type SaveSignageSettingsInput = {
  companyId: string;
  shopId: string;
  branchId: string | null;
  userId: string | null;
  patch: Partial<SignageConfig>;
};

/**
 * Persist a config for exactly one scope (branch row or shop-wide row).
 *
 * Uses select-then-write instead of `upsert(onConflict)` because the unique index on
 * `(shop_id, branch_id)` is partial (`where is_deleted = false`), which PostgREST
 * cannot target in an ON CONFLICT clause.
 *
 * @returns the saved config and the row id.
 */
export async function saveSignageSettings(
  client: SupabaseClient,
  input: SaveSignageSettingsInput,
): Promise<{ config: SignageConfig; settings_id: string }> {
  let existing = client
    .from('signage_settings')
    .select(SIGNAGE_ROW_SELECT)
    .eq('shop_id', input.shopId)
    .eq('is_deleted', false);
  existing = input.branchId ? existing.eq('branch_id', input.branchId) : existing.is('branch_id', null);
  const { data: row, error: readError } = await existing.limit(1).maybeSingle<SignageSettingsRow>();
  if (readError) throw readError;

  const merged = SignageConfigSchema.parse({ ...normalizeSignageRow(row), ...input.patch });

  if (row) {
    const { error } = await client
      .from('signage_settings')
      .update({ ...merged, updated_by: input.userId })
      .eq('id', row.id)
      .eq('shop_id', input.shopId);
    if (error) throw error;
    return { config: merged, settings_id: row.id };
  }

  const { data: inserted, error: insertError } = await client
    .from('signage_settings')
    .insert({
      ...merged,
      company_id: input.companyId,
      shop_id: input.shopId,
      branch_id: input.branchId,
      is_demo: false,
      created_by: input.userId,
      updated_by: input.userId,
    })
    .select('id')
    .single<{ id: string }>();
  if (insertError) throw insertError;
  return { config: merged, settings_id: inserted.id };
}
