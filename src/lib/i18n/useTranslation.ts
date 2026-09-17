'use client';

import { useCallback } from 'react';
import { useI18n } from '@/lib/i18n/provider';

/**
 * Namespace-aware translate hook.
 *
 * `t` is memoised so it only changes identity when the dictionary changes —
 * components that put it in effect deps must not re-run on every render.
 */
export function useTranslation(namespace?: string) {
  const { t, tNamespace, ...rest } = useI18n();
  const translate = useCallback(
    (key: string, fallback?: string) => (namespace ? tNamespace(namespace, key, fallback) : t(key, fallback)),
    [namespace, t, tNamespace],
  );
  return { t: translate, ...rest };
}
