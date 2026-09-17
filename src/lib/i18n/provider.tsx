'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getLanguages, getTranslations } from '@/lib/i18n/client';
import { getFallbackByLang } from '@/lib/i18n/fallback';
import type { Lang, LanguageOption, TranslationMap } from '@/lib/i18n/types';

type I18nContextValue = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string, fallback?: string) => string;
  tNamespace: (namespace: string, key: string, fallback?: string) => string;
  languages: LanguageOption[];
  loading: boolean;
};

const I18nContext = createContext<I18nContextValue | null>(null);

function normalizeLegacyKey(key: string) {
  if (key.includes('.')) return key;
  return `menu.${key}`;
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('th');
  const [languages, setLanguages] = useState<LanguageOption[]>([{ code: 'th', name: 'ภาษาไทย' }, { code: 'en', name: 'English' }]);
  const [loading, setLoading] = useState(true);
  const [dictionary, setDictionary] = useState<TranslationMap>(getFallbackByLang('th'));

  const load = useCallback(async (nextLang: Lang) => {
    setLoading(true);
    try {
      const [langs, payload] = await Promise.all([getLanguages(), getTranslations(nextLang)]);
      if (langs?.length) setLanguages(langs);
      setDictionary(payload?.translations ?? getFallbackByLang(nextLang));
    } catch {
      setDictionary(getFallbackByLang(nextLang));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const saved = (typeof window !== 'undefined'
      ? (localStorage.getItem('app_language') ?? localStorage.getItem('app_lang'))
      : null) as Lang | null;
    const initial = saved === 'en' || saved === 'th' ? saved : 'th';
    setLangState(initial);
    if (typeof document !== 'undefined') document.documentElement.lang = initial;
    void load(initial);
  }, [load]);

  function setLang(l: Lang) {
    setLangState(l);
    if (typeof window !== 'undefined') {
      localStorage.setItem('app_language', l);
      localStorage.setItem('app_lang', l);
    }
    if (typeof document !== 'undefined') document.documentElement.lang = l;
    void load(l);
  }

  const t = useCallback((key: string, fallback?: string) => {
    const normalized = normalizeLegacyKey(key);
    return dictionary[normalized] ?? dictionary[key] ?? fallback ?? normalized;
  }, [dictionary]);

  const tNamespace = useCallback(
    (namespace: string, key: string, fallback?: string) => t(`${namespace}.${key}`, fallback),
    [t],
  );

  const value = useMemo<I18nContextValue>(() => ({
    lang,
    setLang,
    t,
    tNamespace,
    languages,
    loading,
  }), [lang, t, tNamespace, languages, loading]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside I18nProvider');
  return ctx;
}
