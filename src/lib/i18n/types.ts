export type Lang = 'th' | 'en';

export type LanguageOption = {
  code: Lang | string;
  name: string;
  native_name?: string | null;
  is_default?: boolean;
};

export type TranslationMap = Record<string, string>;

export type I18nPayload = {
  language: string;
  fallback_language: string;
  translations: TranslationMap;
  fallback_translations: TranslationMap;
};
