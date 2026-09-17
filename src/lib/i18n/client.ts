import type { I18nPayload, LanguageOption } from '@/lib/i18n/types';

export async function getLanguages(): Promise<LanguageOption[]> {
  const res = await fetch('/api/i18n/languages', { cache: 'no-store' });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? 'Failed to load languages');
  return json.data ?? [];
}

export async function getTranslations(languageCode: string): Promise<I18nPayload> {
  const res = await fetch(`/api/i18n/translations?lang=${encodeURIComponent(languageCode)}`, { cache: 'no-store' });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? 'Failed to load translations');
  return json.data;
}

export async function getTranslationsByNamespace(languageCode: string, namespace: string): Promise<I18nPayload> {
  const res = await fetch(`/api/i18n/translations?lang=${encodeURIComponent(languageCode)}&namespace=${encodeURIComponent(namespace)}`, { cache: 'no-store' });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? 'Failed to load translations');
  return json.data;
}
