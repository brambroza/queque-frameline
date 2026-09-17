import { createAdminClient } from '@/lib/supabase/admin';
import { getFallbackByLang } from '@/lib/i18n/fallback';
import type { I18nPayload, LanguageOption, TranslationMap } from '@/lib/i18n/types';

function normalizeRows(rows: Array<{ ns: string; key: string; value: string }>): TranslationMap {
  const out: TranslationMap = {};
  rows.forEach((r) => {
    out[`${r.ns}.${r.key}`] = r.value;
  });
  return out;
}

export async function getLanguageOptions(): Promise<LanguageOption[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('languages')
    .select('code,name,native_name,is_default')
    .eq('active', true)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getTranslationsForLanguage(languageCode: string, namespaceCode?: string): Promise<I18nPayload> {
  const lang = languageCode === 'en' ? 'en' : 'th';
  const admin = createAdminClient();

  let currentQuery = admin
    .from('translations')
    .select('translation_key,translation_value,translation_namespaces!inner(code)')
    .eq('language_code', lang)
    .eq('active', true);
  if (namespaceCode) currentQuery = currentQuery.eq('translation_namespaces.code', namespaceCode);
  const { data: currentRows, error: currentError } = await currentQuery;
  if (currentError) throw currentError;

  let fallbackQuery = admin
    .from('translations')
    .select('translation_key,translation_value,translation_namespaces!inner(code)')
    .eq('language_code', 'th')
    .eq('active', true);
  if (namespaceCode) fallbackQuery = fallbackQuery.eq('translation_namespaces.code', namespaceCode);
  const { data: fallbackRows, error: fallbackError } = await fallbackQuery;
  if (fallbackError) throw fallbackError;

  const current = normalizeRows(
    (currentRows ?? []).map((r) => ({
      ns: String((r.translation_namespaces as { code?: string } | null)?.code ?? 'common'),
      key: String(r.translation_key),
      value: String(r.translation_value),
    })),
  );

  const fallback = normalizeRows(
    (fallbackRows ?? []).map((r) => ({
      ns: String((r.translation_namespaces as { code?: string } | null)?.code ?? 'common'),
      key: String(r.translation_key),
      value: String(r.translation_value),
    })),
  );

  const fallbackDict = getFallbackByLang(lang);
  const fallbackThaiDict = getFallbackByLang('th');

  return {
    language: lang,
    fallback_language: 'th',
    translations: { ...fallbackDict, ...fallbackThaiDict, ...fallback, ...current },
    fallback_translations: { ...fallbackThaiDict, ...fallback },
  };
}
